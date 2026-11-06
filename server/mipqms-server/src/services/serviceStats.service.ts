import { QueueStatus } from "@prisma/client";
import { prisma } from "../config/database";

/**
 * SERVICE-TIME DATA SOURCE (documented per the Phase 12 requirement):
 *
 * The `Consultation` model exists in the schema but has no
 * controller/service/routes built yet (a future phase) — it currently
 * holds zero rows in any real deployment of this system. Rather than
 * waiting for that phase or fabricating data, this reuses something
 * that already IS populated today: `QueueEntry.consultationStartTime`
 * and `QueueEntry.consultationEndTime`, both set by the existing Phase
 * 9 status-transition logic (`CALLED → IN_CONSULTATION` sets the
 * start; `IN_CONSULTATION → COMPLETED` sets the end). Every queue entry
 * that has genuinely completed the full clinical flow already carries
 * a real, honest service duration — no new field or model was needed.
 *
 * ROLLING WINDOW: the most recent 20 completed entries per department.
 * MINIMUM SAMPLE: at least 5 of those are required before the average
 * is considered trustworthy enough to use — fewer than that returns
 * "unavailable" rather than an average computed from too little data.
 * Both numbers are plain named constants below, not user-configurable
 * in this MVP (unlike PriorityConfig, which this phase does not touch).
 */
const ROLLING_WINDOW = 20;
const MIN_SAMPLE_SIZE = 5;

export interface ServiceTimeResult {
  averageServiceMinutes: number | null;
  sampleSize: number;
}

/**
 * Computes the LIVE rolling average for a department — the source of
 * truth the estimator actually uses. Never fabricates a number: fewer
 * than MIN_SAMPLE_SIZE genuinely completed entries returns
 * `averageServiceMinutes: null`, which the caller must treat as
 * "estimate unavailable," not as zero or any other placeholder.
 */
export async function computeAverageServiceMinutes(departmentId: string): Promise<ServiceTimeResult> {
  const recentCompleted = await prisma.queueEntry.findMany({
    where: {
      departmentId,
      status: QueueStatus.COMPLETED,
      consultationStartTime: { not: null },
      consultationEndTime: { not: null },
    },
    orderBy: { consultationEndTime: "desc" },
    take: ROLLING_WINDOW,
    select: { consultationStartTime: true, consultationEndTime: true },
  });

  if (recentCompleted.length < MIN_SAMPLE_SIZE) {
    return { averageServiceMinutes: null, sampleSize: recentCompleted.length };
  }

  const totalMinutes = recentCompleted.reduce((sum: number, entry: { consultationStartTime: Date | null; consultationEndTime: Date | null }) => {
    const durationMs = entry.consultationEndTime!.getTime() - entry.consultationStartTime!.getTime();
    return sum + durationMs / 60000;
  }, 0);

  const average = totalMinutes / recentCompleted.length;
  return { averageServiceMinutes: Math.round(average * 10) / 10, sampleSize: recentCompleted.length };
}

/**
 * Refreshes the `DepartmentServiceStat` cache for a department — reusing
 * the existing model exactly as it already exists, scoped to
 * `doctorId: null` since no queue entry in the system currently has
 * `assignedDoctorId` populated (nothing in Phases 9–11 sets it), so
 * doctor-level granularity isn't knowable yet. This is a cache
 * refreshed on a specific trigger (a queue entry just completed —
 * called from `queue.service.ts`'s `updateStatus`), mirroring the exact
 * "live calculation, persisted only on explicit triggers" pattern
 * already established for `QueueEntry.priorityScore` in Phase 11 — the
 * estimator endpoint itself still always reads the live calculation
 * above, never this cached value, for the same reason Phase 11's
 * priority score is never trusted stale on a plain read.
 *
 * Implemented as an explicit find-then-update-or-create rather than
 * Prisma's `upsert` against the `[departmentId, doctorId]` compound
 * unique key: standard SQL treats NULL as never equal to NULL, so a
 * unique constraint containing a nullable column does not reliably
 * catch a second `doctorId: null` row for the same department via the
 * database's own conflict-detection — `upsert` cannot be trusted to
 * find the existing row in that case. This function does the lookup
 * explicitly instead, so correctness doesn't depend on that edge case.
 */
export async function refreshDepartmentServiceStat(departmentId: string): Promise<void> {
  const { averageServiceMinutes, sampleSize } = await computeAverageServiceMinutes(departmentId);
  if (averageServiceMinutes === null) return; // don't cache an "unavailable" state as if it were a real number

  const existing = await prisma.departmentServiceStat.findFirst({
    where: { departmentId, doctorId: null },
  });

  if (existing) {
    await prisma.departmentServiceStat.update({
      where: { id: existing.id },
      data: { averageServiceMinutes, sampleSize },
    });
  } else {
    await prisma.departmentServiceStat.create({
      data: { departmentId, doctorId: null, averageServiceMinutes, sampleSize },
    });
  }
}
