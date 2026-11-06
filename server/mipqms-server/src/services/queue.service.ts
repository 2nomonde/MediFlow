import { AuditAction, Prisma, QueueEntry, QueueStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { attachQueueNumbers, computeWaitingMinutes } from "../utils/queueDisplay";
import { computeFullPriority, type FullPriorityInfo } from "./priority.service";
import { priorityConfigService } from "./priorityConfig.service";
import { refreshDepartmentServiceStat } from "./serviceStats.service";
import type { CheckInInput, ListQueueQuery } from "../validators/queue.validators";

const ACTIVE_STATUSES: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_CONSULTATION];

/** Roles that may see the full priority explanation and override details. Everyone else (RECEPTIONIST) gets the score only. */
const CLINICAL_PRIORITY_ROLES: UserRole[] = [UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN];

/**
 * Phase 11 addition: `patient.vulnerabilityCategory`, `triage.priorityLevel`,
 * and `priorityOverriddenBy` are now included so every queue response can
 * carry full, explainable priority information — this is the "update the
 * existing queue endpoint" the Phase 11 brief calls for, not a second
 * queue endpoint.
 */
export const queueEntryInclude = {
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      vulnerabilityCategory: true,
    },
  },
  department: { select: { id: true, name: true } },
  triage: { select: { priorityLevel: true } },
  priorityOverriddenBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.QueueEntryInclude;

export type QueueEntryWithRelations = Prisma.QueueEntryGetPayload<{ include: typeof queueEntryInclude }>;
type PriorityConfigValues = Awaited<ReturnType<typeof priorityConfigService.getActiveValues>>;

/**
 * Controlled status transitions (Rule: reject invalid transitions, e.g.
 * COMPLETED → WAITING). WAITING never appears as a target — it is only
 * ever the creation default, nothing transitions back into it.
 */
const ALLOWED_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  WAITING: [QueueStatus.CALLED, QueueStatus.CANCELLED, QueueStatus.NO_SHOW],
  CALLED: [QueueStatus.IN_CONSULTATION, QueueStatus.CANCELLED, QueueStatus.NO_SHOW],
  IN_CONSULTATION: [QueueStatus.COMPLETED, QueueStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * Role-scoping *within* the shared status-update endpoint, on top of the
 * route-level `requireRole` (defense in depth, same pattern used
 * elsewhere in this codebase): RECEPTIONIST may only record
 * CANCELLED/NO_SHOW (front-desk outcomes — a patient leaving or never
 * arriving), never the clinical-progression statuses. NURSE, DOCTOR, and
 * ADMIN may set any valid transition target.
 */
function assertRoleCanSetStatus(role: UserRole, targetStatus: QueueStatus): void {
  if (role === UserRole.RECEPTIONIST) {
    const allowed: QueueStatus[] = [QueueStatus.CANCELLED, QueueStatus.NO_SHOW];
    if (!allowed.includes(targetStatus)) {
      throw ApiError.forbidden(
        "Receptionists may cancel or mark a patient as no-show, but cannot move them through the clinical queue."
      );
    }
  }
}

function isActiveQueueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes("active_queue_entry") || targetText.includes("patientId");
}

/**
 * ROLE-AWARE RESPONSE PROJECTION — the actual RBAC enforcement point for
 * priority data. This is the ONLY place priority fields are attached to
 * a queue-entry response; every method below (list, getById, checkIn,
 * updateStatus, callNext) routes through this single function rather
 * than each spreading fields inline, specifically so this rule can
 * never again be satisfied in one code path and missed in another.
 *
 * RECEPTIONIST (and any future non-clinical role) receives:
 *   triagePriority, priorityScore, hasManualOverride, effectivePriority
 * — enough to understand and trust the queue order, nothing that
 * exposes a clinician's override reasoning, identity, or timestamp.
 *
 * NURSE/DOCTOR/ADMIN additionally receive:
 *   priorityBreakdown, manualOverride, overrideReason, overriddenBy,
 *   overriddenAt
 */
function projectPriorityFields(priorityInfo: FullPriorityInfo, viewerRole: UserRole) {
  const base = {
    triagePriority: priorityInfo.triagePriority,
    priorityScore: priorityInfo.breakdown.calculatedScore,
    hasManualOverride: priorityInfo.hasManualOverride,
    effectivePriority: priorityInfo.effectivePriority,
  };

  if (!CLINICAL_PRIORITY_ROLES.includes(viewerRole)) {
    return base;
  }

  return {
    ...base,
    priorityBreakdown: priorityInfo.breakdown,
    manualOverride: priorityInfo.manualOverride,
    overrideReason: priorityInfo.overrideReason,
    overriddenBy: priorityInfo.overriddenBy,
    overriddenAt: priorityInfo.overriddenAt,
  };
}

/**
 * Builds the full, enriched queue-entry response: queue number, waiting
 * time (Phase 9), plus the role-appropriate priority picture (see
 * `projectPriorityFields`). The `priorityScore` in the response is
 * always the LIVE calculated figure — never the possibly-stale
 * `QueueEntry.priorityScore` database column — because the brief
 * requires priority to be current whenever queue data is retrieved.
 * That column is still written to, but only on the specific triggers
 * documented in Phase11_Intelligent_Priority_Engine.md ("When Priority
 * Is Persisted"), never on a plain read.
 */
async function buildQueueResponse(entry: QueueEntryWithRelations, config: PriorityConfigValues, viewerRole: UserRole) {
  const [withNumber] = await attachQueueNumbers([
    { id: entry.id, departmentId: entry.departmentId, departmentName: entry.department.name, checkInTime: entry.checkInTime },
  ]);
  const priorityInfo: FullPriorityInfo = await computeFullPriority(entry, config);

  // Strip BOTH the raw relation objects (triage, priorityOverriddenBy)
  // AND the raw override scalar columns (manualPriorityOverride,
  // manualPriorityReason, priorityOverriddenById, priorityOverriddenAt).
  // The scalar columns matter just as much as the relation: they carry
  // the exact same reason/user/timestamp information projectPriorityFields
  // is gating, just under their raw Prisma column names — a role that's
  // meant to be blocked from `overrideReason` must not receive the same
  // text back as `manualPriorityReason` via an unfiltered object spread.
  // projectPriorityFields() below is what actually decides what a given
  // viewerRole gets; everything raw must be removed here first so there
  // is no second, un-gated path for the same data to leak through.
  const {
    triage: _triage,
    priorityOverriddenBy: _priorityOverriddenBy,
    manualPriorityOverride: _manualPriorityOverride,
    manualPriorityReason: _manualPriorityReason,
    priorityOverriddenById: _priorityOverriddenById,
    priorityOverriddenAt: _priorityOverriddenAt,
    ...rest
  } = entry;

  return {
    ...rest,
    queueNumber: withNumber.queueNumber,
    waitingMinutes: computeWaitingMinutes(entry.checkInTime, entry.calledTime),
    ...projectPriorityFields(priorityInfo, viewerRole),
  };
}

/**
 * Ranks all WAITING entries in a department by the exact Phase 11
 * effective-priority ordering (effectivePriority DESC, checkInTime ASC,
 * id ASC as final tiebreaker). Exported so both `callNext` (below) and
 * the Phase 12 waiting-time estimator (`waitEstimate.service.ts`) share
 * this ONE ranking implementation — per the Phase 12 requirement not to
 * create a second queue-ranking algorithm. Previously `callNext` had
 * its own inline copy of this sort; that duplication is now removed.
 */
export async function rankWaitingEntriesInDepartment(
  departmentId: string,
  config: PriorityConfigValues
): Promise<Array<{ entry: QueueEntryWithRelations; priorityInfo: FullPriorityInfo }>> {
  const waiting = await prisma.queueEntry.findMany({
    where: { departmentId, status: QueueStatus.WAITING },
    include: queueEntryInclude,
    take: 200, // defensive cap — see `list`'s comment on DISPLAY_CAP
  });

  const ranked = await Promise.all(
    waiting.map(async (entry: QueueEntryWithRelations) => ({
      entry,
      priorityInfo: await computeFullPriority(entry, config),
    }))
  );

  ranked.sort((a, b) => {
    if (b.priorityInfo.effectivePriority !== a.priorityInfo.effectivePriority) {
      return b.priorityInfo.effectivePriority - a.priorityInfo.effectivePriority;
    }
    const checkInDiff = a.entry.checkInTime.getTime() - b.entry.checkInTime.getTime();
    if (checkInDiff !== 0) return checkInDiff;
    return a.entry.id.localeCompare(b.entry.id);
  });

  return ranked;
}

/**
 * The validated core of a queue status transition — checks the entry
 * exists, checks the role restriction, checks the transition against
 * `ALLOWED_TRANSITIONS` (the one and only transition map in this
 * codebase), and applies it with the correct timestamp field. Takes a
 * Prisma client OR an interactive-transaction client (`Prisma.TransactionClient`)
 * so callers that need this transition to participate in a larger
 * atomic operation — Phase 13's consultation start/complete — can pass
 * their transaction's `tx` instead of the global client, while
 * `queueService.updateStatus` below (used by the plain queue-status
 * route) keeps calling it with the global client exactly as before.
 * Exported so consultation.service.ts can reuse this instead of
 * re-implementing transition validation.
 */
export async function applyQueueStatusTransition(
  client: Prisma.TransactionClient,
  id: string,
  targetStatus: QueueStatus,
  actingRole: UserRole
): Promise<QueueEntryWithRelations> {
  const entry = await client.queueEntry.findUnique({ where: { id } });
  if (!entry) throw ApiError.notFound("Queue entry not found.");

  assertRoleCanSetStatus(actingRole, targetStatus);

  const allowedNext = ALLOWED_TRANSITIONS[entry.status];
  if (!allowedNext.includes(targetStatus)) {
    throw ApiError.conflict(`Cannot move a queue entry from ${entry.status} to ${targetStatus}.`);
  }

  // Priority/scoring fields are never touched here — a status change is
  // not one of the documented recalculation triggers, and this
  // function's only job is the status transition itself.
  const data: Prisma.QueueEntryUpdateInput = { status: targetStatus };
  if (targetStatus === QueueStatus.CALLED) data.calledTime = new Date();
  if (targetStatus === QueueStatus.IN_CONSULTATION) data.consultationStartTime = new Date();
  if (targetStatus === QueueStatus.COMPLETED) data.consultationEndTime = new Date();

  return client.queueEntry.update({ where: { id }, data, include: queueEntryInclude });
}

export const queueService = {
  async checkIn(input: CheckInInput, viewerRole: UserRole, userId: string) {
    const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
    if (!patient) throw ApiError.notFound("Patient not found.");

    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw ApiError.notFound("Department not found.");

    const existingActive = await prisma.queueEntry.findFirst({
      where: { patientId: input.patientId, status: { in: ACTIVE_STATUSES } },
    });
    if (existingActive) {
      throw ApiError.conflict("This patient is already in an active queue.", {
        existingQueueEntryId: existingActive.id,
      });
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const entry = await tx.queueEntry.create({
          data: {
            patientId: input.patientId,
            departmentId: input.departmentId,
            isEmergency: input.isEmergency,
            // priorityScore/priorityCalculatedAt/manualPriorityOverride and
            // friends are deliberately never set here.
          },
          include: queueEntryInclude,
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: AuditAction.CHECK_IN,
            entityType: "QueueEntry",
            entityId: entry.id,
            queueEntryId: entry.id,
            newValue: {
              status: entry.status,
              patientId: input.patientId,
              departmentId: input.departmentId,
              isEmergency: input.isEmergency,
            },
            description: "Patient checked in to the queue.",
          },
        });

        return entry;
      });

      const config = await priorityConfigService.getActiveValues();
      return buildQueueResponse(created, config, viewerRole);
    } catch (error) {
      if (isActiveQueueConflict(error)) {
        throw ApiError.conflict("This patient is already in an active queue.");
      }
      throw error;
    }
  },

  /**
   * Phase 11 changes the ORDERING strategy: waiting patients are now
   * ranked by calculated priority score, which cannot be expressed as a
   * SQL ORDER BY (the score is computed from live data, not a trusted
   * stored column — see buildQueueResponse's comment). So: fetch
   * today's matching entries (capped defensively at 500 — a single
   * clinic's daily queue is realistically far smaller; a persisted,
   * indexed score would be the right answer if this ever needed to
   * scale beyond that, which is out of scope for this phase), compute
   * each one's effective priority in application code, sort, then
   * paginate in memory. `total` still comes from a real COUNT query so
   * pagination metadata stays accurate even if the display cap were
   * ever hit.
   */
  async list(query: ListQueueQuery, viewerRole: UserRole) {
    const { status, departmentId, page, pageSize } = query;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const where: Prisma.QueueEntryWhereInput = {
      checkInTime: { gte: todayStart, lt: todayEnd },
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
    };

    const DISPLAY_CAP = 500;
    const [total, entries] = await prisma.$transaction([
      prisma.queueEntry.count({ where }),
      prisma.queueEntry.findMany({ where, include: queueEntryInclude, take: DISPLAY_CAP }),
    ]);

    const config = await priorityConfigService.getActiveValues();
    const withPriority = await Promise.all(
      entries.map(async (entry: QueueEntryWithRelations) => ({
        
        entry,
        priorityInfo: await computeFullPriority(entry, config),
      }))
    );

    // Basic deterministic order, now driven by score (Rule: still NOT a
    // black box — effectivePriority is the plain sum/override computed
    // above, fully explainable via priorityBreakdown in the response).
    withPriority.sort((a, b) => {
      if (b.priorityInfo.effectivePriority !== a.priorityInfo.effectivePriority) {
        return b.priorityInfo.effectivePriority - a.priorityInfo.effectivePriority;
      }
      const checkInDiff = a.entry.checkInTime.getTime() - b.entry.checkInTime.getTime();
      if (checkInDiff !== 0) return checkInDiff;
      return a.entry.id.localeCompare(b.entry.id);
    });

    const pageEntries = withPriority.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map((x) => x.entry);

    const withNumbers = await attachQueueNumbers(
      pageEntries.map((e: QueueEntryWithRelations) => ({
        id: e.id,
        departmentId: e.departmentId,
        departmentName: e.department.name,
        checkInTime: e.checkInTime,
      }))
    );
    const numberById = new Map(withNumbers.map((e) => [e.id, e.queueNumber]));
    const priorityById = new Map(withPriority.map((x) => [x.entry.id, x.priorityInfo]));

    // Routed through the SAME projectPriorityFields() used by
    // buildQueueResponse. The raw override scalar columns
    // (manualPriorityOverride, manualPriorityReason,
    // priorityOverriddenById, priorityOverriddenAt) are stripped here
    // for the same reason as in buildQueueResponse — an unfiltered
    // object spread would leak them under their raw column names
    // regardless of what projectPriorityFields decides to attach.
    const data = pageEntries.map((entry: QueueEntryWithRelations) => {
      const priorityInfo = priorityById.get(entry.id)!;
      const {
        triage: _triage,
        priorityOverriddenBy: _priorityOverriddenBy,
        manualPriorityOverride: _manualPriorityOverride,
        manualPriorityReason: _manualPriorityReason,
        priorityOverriddenById: _priorityOverriddenById,
        priorityOverriddenAt: _priorityOverriddenAt,
        ...rest
      } = entry;
      return {
        ...rest,
        queueNumber: numberById.get(entry.id) ?? "—",
        waitingMinutes: computeWaitingMinutes(entry.checkInTime, entry.calledTime),
        ...projectPriorityFields(priorityInfo, viewerRole),
      };
    });

    return {
      entries: data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  },

  async getById(id: string, viewerRole: UserRole) {
    const entry = await prisma.queueEntry.findUnique({ where: { id }, include: queueEntryInclude });
    if (!entry) throw ApiError.notFound("Queue entry not found.");
    const config = await priorityConfigService.getActiveValues();
    return buildQueueResponse(entry, config, viewerRole);
  },

  async updateStatus(
    id: string,
    targetStatus: QueueStatus,
    actingRole: UserRole,
    userId: string
  ) {
    // Reuses the exact same validated transition core that Phase 13's
    // consultation start/complete now also call — ALLOWED_TRANSITIONS
    // remains the single source of truth, defined once above.
    const { updated } = await prisma.$transaction(async (tx) => {
      const existing = await tx.queueEntry.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!existing) {
        throw ApiError.notFound("Queue entry not found.");
      }

      const updatedEntry = await applyQueueStatusTransition(
        tx,
        id,
        targetStatus,
        actingRole
      );

      let auditAction: AuditAction | null = null;

      if (targetStatus === QueueStatus.CANCELLED) {
        auditAction = AuditAction.QUEUE_CANCELLED;
      } else if (targetStatus === QueueStatus.NO_SHOW) {
        auditAction = AuditAction.NO_SHOW_MARKED;
      } else if (targetStatus === QueueStatus.CALLED) {
        auditAction = AuditAction.PATIENT_CALLED;
      }

      if (auditAction) {
        await tx.auditLog.create({
          data: {
            userId,
            action: auditAction,
            entityType: "QueueEntry",
            entityId: id,
            queueEntryId: id,
            previousValue: { status: existing.status },
            newValue: { status: targetStatus },
            description: `Queue status changed from ${existing.status} to ${targetStatus}.`,
          },
        });
      }

      return { updated: updatedEntry };
    });

    if (targetStatus === QueueStatus.COMPLETED) {
      // Phase 12 addition: this queue entry just contributed a real,
      // honest service duration (consultationStartTime → just-set
      // consultationEndTime). Refresh the department's cached rolling
      // average now, on this specific trigger — the estimator itself
      // still always computes live (see serviceStats.service.ts), so a
      // failure here must never block the status update that's the
      // actual point of this call. Awaited but internally best-effort,
      // matching the exact pattern already used for Phase 11's
      // triage-triggered recalculation (triage.service.ts).
      try {
        await refreshDepartmentServiceStat(updated.departmentId);
      } catch (error) {
        console.error(`⚠️ Failed to refresh service-time stats for department ${updated.departmentId}:`, error);
      }
    }

    const config = await priorityConfigService.getActiveValues();
    return buildQueueResponse(updated, config, actingRole);
  },

  /**
   * Phase 11 changes candidate SELECTION to the calculated priority
   * score (previously emergency-flag-then-FIFO only, Phase 9) — "call
   * next" now calls whoever the engine currently ranks highest, so the
   * live queue order shown to staff and who actually gets called next
   * never disagree. Concurrency safety (the `updateMany` optimistic
   * lock, retried against a fresh candidate on a lost race) is
   * unchanged from Phase 9. `viewerRole` here is always a clinical role
   * in practice (call-next is gated to NURSE/DOCTOR/ADMIN at the route),
   * but the response still goes through the same projection for
   * consistency and in case that route gate is ever loosened.
   */
  async callNext(
    departmentId: string,
    viewerRole: UserRole,
    userId: string
  ) {
    const MAX_ATTEMPTS = 3;
    const config = await priorityConfigService.getActiveValues();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const ranked = await rankWaitingEntriesInDepartment(departmentId, config);

      if (ranked.length === 0) {
        throw ApiError.notFound("No patients are currently waiting in this department.");
      }

      const candidate = ranked[0].entry;



      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.queueEntry.updateMany({
          where: {
            id: candidate.id,
            status: QueueStatus.WAITING,
          },
          data: {
            status: QueueStatus.CALLED,
            calledTime: new Date(),
          },
        });

        if (result.count !== 1) {
          return null;
        }

        const entry = await tx.queueEntry.findUniqueOrThrow({
          where: { id: candidate.id },
          include: queueEntryInclude,
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: AuditAction.PATIENT_CALLED,
            entityType: "QueueEntry",
            entityId: candidate.id,
            queueEntryId: candidate.id,
            previousValue: {
              status: QueueStatus.WAITING,
            },
            newValue: {
              status: QueueStatus.CALLED,
            },
            description: "Patient called from the waiting queue.",
          },
        });

        return entry;
      });

      if (updated) {
        return buildQueueResponse(updated, config, viewerRole);
      }

      // If another user called the patient first, retry with fresh data.
      // else: lost the race, loop and re-rank against fresh data
    }

    throw ApiError.conflict("Could not call the next patient due to a conflicting update. Please try again.");
  },
};

export type { QueueEntry };
