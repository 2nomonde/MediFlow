import { Prisma, QueueStatus, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../config/database";
import type { ReportSummaryQuery } from "../validators/report.validators";

/**
 * Defensive cap on the one in-memory computation this service performs
 * (Section below). At real clinic scale (a single facility's queue
 * volume over up to a year, the schema's own max range) this is never
 * remotely close to being hit — it exists purely so a pathological
 * date range can't load an unbounded number of rows into memory.
 */
const MAX_COMPLETED_ENTRIES_FOR_DURATION_CALC = 5000;

interface DurationStats {
  averageMinutes: number | null;
  sampleSize: number;
}

function summarizeDurations(durationsMinutes: number[]): DurationStats {
  if (durationsMinutes.length === 0) return { averageMinutes: null, sampleSize: 0 };
  const total = durationsMinutes.reduce((sum, m) => sum + m, 0);
  return { averageMinutes: Math.round(total / durationsMinutes.length), sampleSize: durationsMinutes.length };
}

export const reportService = {
  /**
   * GET /api/reports/summary
   *
   * `[rangeStart, rangeEnd)` — a half-open interval, per the brief's
   * explicit preference over ambiguous inclusive timestamps. `rangeEnd`
   * is `dateTo` advanced by exactly one calendar day, so a same-day
   * range (`dateFrom === dateTo`, e.g. the "Today" preset) correctly
   * covers that entire day and nothing beyond it.
   */
  async getSummary(query: ReportSummaryQuery) {
    const { dateFrom, departmentId } = query;
    const rangeStart = dateFrom;
    const rangeEnd = new Date(query.dateTo);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const queueDateFilter: Prisma.QueueEntryWhereInput = { checkInTime: { gte: rangeStart, lt: rangeEnd } };
    const queueWhere: Prisma.QueueEntryWhereInput = {
      ...queueDateFilter,
      ...(departmentId ? { departmentId } : {}),
    };

    // --- A. Patient activity -------------------------------------------
    const patientsRegisteredPromise = prisma.patient.count({
      where: { registrationDate: { gte: rangeStart, lt: rangeEnd } },
    });

    // --- B. Queue activity (five focused counts, one transaction) ------
    const queueCountsPromise = prisma.$transaction([
      prisma.queueEntry.count({ where: queueWhere }),
      prisma.queueEntry.count({ where: { ...queueWhere, status: QueueStatus.COMPLETED } }),
      prisma.queueEntry.count({ where: { ...queueWhere, status: QueueStatus.CANCELLED } }),
      prisma.queueEntry.count({ where: { ...queueWhere, status: QueueStatus.NO_SHOW } }),
      prisma.queueEntry.count({ where: { ...queueWhere, isEmergency: true } }),
    ]);

    // --- D. Consultation activity ---------------------------------------
    const consultationWhereBase: Prisma.ConsultationWhereInput = departmentId ? { departmentId } : {};
    const consultationsStartedPromise = prisma.consultation.count({
      where: { ...consultationWhereBase, startedAt: { gte: rangeStart, lt: rangeEnd } },
    });
    const consultationsCompletedPromise = prisma.consultation.count({
      where: { ...consultationWhereBase, completedAt: { gte: rangeStart, lt: rangeEnd } },
    });

    // --- E. Prescription activity ----------------------------------------
    // Prescription has no direct departmentId — only via its consultation
    // — so department scoping here uses a nested relation filter rather
    // than a duplicated column, per "do not introduce duplicated
    // department data."
    const prescriptionDeptFilter: Prisma.PrescriptionWhereInput = departmentId
      ? { consultation: { departmentId } }
      : {};
    const prescriptionsCreatedPromise = prisma.prescription.count({
      where: { ...prescriptionDeptFilter, createdAt: { gte: rangeStart, lt: rangeEnd } },
    });
    const prescriptionsDispensedPromise = prisma.prescription.count({
      where: { ...prescriptionDeptFilter, status: PrescriptionStatus.DISPENSED, dispensedAt: { gte: rangeStart, lt: rangeEnd } },
    });
    // Pending is a CURRENT snapshot, deliberately not date-range-scoped —
    // "prescriptions currently awaiting dispensing" doesn't mean "created
    // within this reporting window," and scoping it that way would hide
    // a still-pending prescription from an earlier period.
    const prescriptionsPendingPromise = prisma.prescription.count({
      where: { ...prescriptionDeptFilter, status: PrescriptionStatus.PENDING },
    });

    // --- Departments list (for the per-department summary section) -----
    const departmentsPromise = prisma.department.findMany({
      where: departmentId ? { id: departmentId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // --- Per-department queue/consultation counts via groupBy ----------
    const queueByDeptPromise = prisma.queueEntry.groupBy({
      by: ["departmentId"],
      where: queueWhere,
      _count: { _all: true },
    });
    const completedQueueByDeptPromise = prisma.queueEntry.groupBy({
      by: ["departmentId"],
      where: { ...queueWhere, status: QueueStatus.COMPLETED },
      _count: { _all: true },
    });
    const completedConsultationsByDeptPromise = prisma.consultation.groupBy({
      by: ["departmentId"],
      where: { ...consultationWhereBase, completedAt: { gte: rangeStart, lt: rangeEnd } },
      _count: { _all: true },
    });

    /**
     * C. Waiting time and service duration — the one deliberate
     * in-memory calculation in this service (documented, per the
     * brief's explicit allowance for "a small number of clearly
     * structured queries" when a metric can't be expressed with
     * Prisma's aggregate APIs). Prisma cannot aggregate the *difference*
     * between two DateTime columns (`consultationStartTime -
     * checkInTime`, `consultationEndTime - consultationStartTime`)
     * without raw SQL — and a hand-written raw query was judged less
     * explainable for this project's academic context than a plain,
     * capped `findMany` + arithmetic pass. Only COMPLETED entries in
     * range are fetched, only the three timestamp columns plus
     * `departmentId` are selected (no patient/clinical data), capped at
     * MAX_COMPLETED_ENTRIES_FOR_DURATION_CALC rows.
     *
     * This is REAL historical waiting time — `consultationStartTime -
     * checkInTime` — never the Phase 12 estimator's predictive figure.
     * Only positive durations count; a negative or zero difference
     * (which shouldn't occur given the existing status-transition
     * ordering, but is not assumed) is silently excluded rather than
     * corrupting the average.
     */
    const completedEntriesPromise = prisma.queueEntry.findMany({
      where: { ...queueWhere, status: QueueStatus.COMPLETED },
      select: { checkInTime: true, consultationStartTime: true, consultationEndTime: true, departmentId: true },
      take: MAX_COMPLETED_ENTRIES_FOR_DURATION_CALC,
    });

    const [
      patientsRegistered,
      [totalQueueEntries, completedQueueEntries, cancelledQueueEntries, noShowQueueEntries, emergencyQueueEntries],
      consultationsStarted,
      consultationsCompleted,
      prescriptionsCreated,
      prescriptionsDispensed,
      prescriptionsPending,
      departments,
      queueByDept,
      completedQueueByDept,
      completedConsultationsByDept,
      completedEntries,
    ] = await Promise.all([
      patientsRegisteredPromise,
      queueCountsPromise,
      consultationsStartedPromise,
      consultationsCompletedPromise,
      prescriptionsCreatedPromise,
      prescriptionsDispensedPromise,
      prescriptionsPendingPromise,
      departmentsPromise,
      queueByDeptPromise,
      completedQueueByDeptPromise,
      completedConsultationsByDeptPromise,
      completedEntriesPromise,
    ]);

    // Overall and per-department duration arrays, computed in one pass.
    const overallWaiting: number[] = [];
    const overallService: number[] = [];
    const waitingByDept = new Map<string, number[]>();
    const serviceByDept = new Map<string, number[]>();

    for (const entry of completedEntries) {
      if (entry.consultationStartTime) {
        const waitingMinutes = Math.round((entry.consultationStartTime.getTime() - entry.checkInTime.getTime()) / 60000);
        if (waitingMinutes > 0) {
          overallWaiting.push(waitingMinutes);
          const list = waitingByDept.get(entry.departmentId) ?? [];
          list.push(waitingMinutes);
          waitingByDept.set(entry.departmentId, list);
        }

        if (entry.consultationEndTime) {
          const serviceMinutes = Math.round((entry.consultationEndTime.getTime() - entry.consultationStartTime.getTime()) / 60000);
          if (serviceMinutes > 0) {
            overallService.push(serviceMinutes);
            const list = serviceByDept.get(entry.departmentId) ?? [];
            list.push(serviceMinutes);
            serviceByDept.set(entry.departmentId, list);
          }
        }
      }
    }

    const waitingStats = summarizeDurations(overallWaiting);
    const serviceStats = summarizeDurations(overallService);

    const queueByDeptMap = new Map(
      queueByDept.map((row: { departmentId: string; _count: { _all: number } }) => [row.departmentId, row._count._all])
    );
    const completedQueueByDeptMap = new Map(
      completedQueueByDept.map((row: { departmentId: string; _count: { _all: number } }) => [row.departmentId, row._count._all])
    );
    const completedConsultationsByDeptMap = new Map(
      completedConsultationsByDept.map((row: { departmentId: string; _count: { _all: number } }) => [row.departmentId, row._count._all])
    );

    const departmentSummaries = departments.map((department: { id: string; name: string }) => {
      const waitingForDept = summarizeDurations(waitingByDept.get(department.id) ?? []);
      const serviceForDept = summarizeDurations(serviceByDept.get(department.id) ?? []);
      return {
        departmentId: department.id,
        departmentName: department.name,
        queueEntries: queueByDeptMap.get(department.id) ?? 0,
        completedQueueEntries: completedQueueByDeptMap.get(department.id) ?? 0,
        avgWaitingMinutes: waitingForDept.averageMinutes,
        avgServiceMinutes: serviceForDept.averageMinutes,
        consultationsCompleted: completedConsultationsByDeptMap.get(department.id) ?? 0,
      };
    });

    return {
      dateRange: {
        from: query.dateFrom.toISOString(),
        to: query.dateTo.toISOString(),
        // rangeEnd is the exclusive internal boundary, exposed for
        // transparency about exactly what window was queried.
        rangeEndExclusive: rangeEnd.toISOString(),
      },
      summary: {
        patientsRegistered,
        queueEntries: totalQueueEntries,
        completedQueueEntries,
        consultationsCompleted,
        prescriptionsCreated,
        prescriptionsDispensed,
      },
      queue: {
        total: totalQueueEntries,
        completed: completedQueueEntries,
        cancelled: cancelledQueueEntries,
        noShow: noShowQueueEntries,
        emergency: emergencyQueueEntries,
      },
      waitingAndService: {
        avgWaitingMinutes: waitingStats.averageMinutes,
        waitingSampleSize: waitingStats.sampleSize,
        avgServiceMinutes: serviceStats.averageMinutes,
        serviceSampleSize: serviceStats.sampleSize,
      },
      consultations: {
        started: consultationsStarted,
        completed: consultationsCompleted,
      },
      prescriptions: {
        created: prescriptionsCreated,
        dispensed: prescriptionsDispensed,
        pending: prescriptionsPending,
      },
      departments: departmentSummaries,
    };
  },
};
