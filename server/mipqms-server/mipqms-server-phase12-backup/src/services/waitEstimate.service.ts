import { QueueStatus } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { attachQueueNumbers } from "../utils/queueDisplay";
import { computeFullPriority } from "./priority.service";
import { priorityConfigService } from "./priorityConfig.service";
import { computeAverageServiceMinutes } from "./serviceStats.service";
import { queueEntryInclude, rankWaitingEntriesInDepartment } from "./queue.service";

/**
 * SERVICE CAPACITY (documented per the Phase 12 requirement): no
 * existing model tells this system how many doctors/service providers
 * are actually on duty for a department right now — `assignedDoctorId`
 * is never populated by any current write path (Phases 9–11), and there
 * is no staff-roster/scheduling model to query instead. Building one is
 * explicitly out of scope for this phase. Rather than guess, this uses
 * the brief's own suggested conservative, clearly-documented assumption:
 * exactly one active service stream per department. If a future phase
 * adds real on-duty tracking, only this one constant (and the guard
 * below) needs to change — nothing else in the formula does.
 */
const SERVICE_CAPACITY = 1;

/** In-progress statuses that occupy the (assumed single) service stream ahead of anyone still WAITING. */
const IN_PROGRESS_STATUSES: QueueStatus[] = [QueueStatus.CALLED, QueueStatus.IN_CONSULTATION];

export interface WaitEstimateResult {
  queueEntryId: string;
  queueNumber: string;
  status: QueueStatus;
  effectivePriority: number;
  patientsAhead: number | null;
  averageServiceMinutes: number | null;
  serviceCapacity: number;
  estimatedWaitMinutes: number | null;
  estimateAvailable: boolean;
  reason: string | null;
  sampleSize: number;
  calculatedAt: string;
}

/**
 * READ-ONLY by construction: every operation below is a `findUnique`,
 * `findMany`, or `count` — there is no `create`/`update`/`delete` call
 * anywhere in this file. Calling this can never change a queue entry's
 * status, priority, triage, or anything else (Phase 12 requirement 22).
 */
export const waitEstimateService = {
  async getEstimate(queueEntryId: string): Promise<WaitEstimateResult> {
    const entry = await prisma.queueEntry.findUnique({ where: { id: queueEntryId }, include: queueEntryInclude });
    if (!entry) throw ApiError.notFound("Queue entry not found.");

    const config = await priorityConfigService.getActiveValues();
    const priorityInfo = await computeFullPriority(entry, config);
    const [{ queueNumber }] = await attachQueueNumbers([
      { id: entry.id, departmentId: entry.departmentId, departmentName: entry.department.name, checkInTime: entry.checkInTime },
    ]);

    const base = {
      queueEntryId: entry.id,
      queueNumber,
      status: entry.status,
      effectivePriority: priorityInfo.effectivePriority,
      serviceCapacity: SERVICE_CAPACITY,
      calculatedAt: new Date().toISOString(),
    };

    // Terminal statuses: a numeric estimate would be meaningless history,
    // not a forecast — say so plainly rather than showing a stale number.
    if (
      entry.status === QueueStatus.COMPLETED ||
      entry.status === QueueStatus.CANCELLED ||
      entry.status === QueueStatus.NO_SHOW
    ) {
      return {
        ...base,
        patientsAhead: null,
        averageServiceMinutes: null,
        estimatedWaitMinutes: null,
        estimateAvailable: false,
        sampleSize: 0,
        reason: "This queue entry is no longer active.",
      };
    }

    // Already being processed: "waiting" no longer applies to them at all.
    if (entry.status === QueueStatus.CALLED) {
      return {
        ...base,
        patientsAhead: null,
        averageServiceMinutes: null,
        estimatedWaitMinutes: null,
        estimateAvailable: false,
        sampleSize: 0,
        reason: "Already called.",
      };
    }
    if (entry.status === QueueStatus.IN_CONSULTATION) {
      return {
        ...base,
        patientsAhead: null,
        averageServiceMinutes: null,
        estimatedWaitMinutes: null,
        estimateAvailable: false,
        sampleSize: 0,
        reason: "In consultation.",
      };
    }

    // From here, entry.status === WAITING.
    //
    // "Patients ahead" = everyone who will be served before this entry
    // under the assumed single service stream:
    //   - every WAITING entry ranked above it by the exact Phase 11
    //     effective-priority order (reused, not recomputed — see
    //     rankWaitingEntriesInDepartment in queue.service.ts), PLUS
    //   - everyone currently CALLED/IN_CONSULTATION in the department,
    //     since with one stream they are necessarily served first.
    // A manual priority override on any entry (this one or another) is
    // already baked into `effectivePriority` by computeFullPriority, so
    // it's automatically respected here with no separate handling.
    const ranked = await rankWaitingEntriesInDepartment(entry.departmentId, config);
    const myIndex = ranked.findIndex((r) => r.entry.id === entry.id);
    const waitingAheadCount = myIndex >= 0 ? myIndex : ranked.length;

    const busyCount = await prisma.queueEntry.count({
      where: { departmentId: entry.departmentId, status: { in: IN_PROGRESS_STATUSES } },
    });

    const patientsAhead = waitingAheadCount + busyCount;

    // Defensive guard against division by zero, even though
    // SERVICE_CAPACITY is currently a fixed positive constant — if a
    // future phase makes it dynamic, this keeps the calculation safe
    // without needing to remember to add the check then.
    const effectiveCapacity = SERVICE_CAPACITY > 0 ? SERVICE_CAPACITY : 1;

    if (patientsAhead === 0) {
      // Next in line — this is exact (zero patients ahead of zero is
      // zero), not an estimate, so it doesn't need service-time data at all.
      return {
        ...base,
        patientsAhead: 0,
        averageServiceMinutes: null,
        estimatedWaitMinutes: 0,
        estimateAvailable: true,
        sampleSize: 0,
        reason: null,
      };
    }

    const { averageServiceMinutes, sampleSize } = await computeAverageServiceMinutes(entry.departmentId);

    if (averageServiceMinutes === null) {
      return {
        ...base,
        patientsAhead,
        averageServiceMinutes: null,
        estimatedWaitMinutes: null,
        estimateAvailable: false,
        sampleSize,
        reason: "Not enough completed service data yet.",
      };
    }

    const estimatedWaitMinutes = Math.round((patientsAhead / effectiveCapacity) * averageServiceMinutes);

    return {
      ...base,
      patientsAhead,
      averageServiceMinutes,
      estimatedWaitMinutes,
      estimateAvailable: true,
      sampleSize,
      reason: null,
    };
  },
};
