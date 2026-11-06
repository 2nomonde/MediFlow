import { prisma } from "../config/database";

/**
 * QUEUE NUMBER STRATEGY (documented per the Phase 9 requirement):
 *
 * The Phase 2 QueueEntry model has no `queueNumber` column. Rather than
 * adding one, Phase 9 derives a human-readable, department-scoped,
 * per-day queue number entirely at read time from fields that already
 * exist: `departmentId` and `checkInTime`.
 *
 * Format: "<DEPT>-<3-digit sequence>", e.g. "GEN-001", where <DEPT> is
 * a short code derived from the department name and the sequence is the
 * entry's rank (by check-in time, ties broken by id) among all queue
 * entries for that department on that same calendar day — regardless of
 * their current status, so a number never changes as an entry moves
 * through the lifecycle or as other entries complete.
 *
 * Why this is safe without a stored, uniquely-constrained column: there
 * is nothing to collide on. The number is recomputed from a COUNT query
 * every time it's displayed, not written and raced over by concurrent
 * requests — two staff checking in patients at the same moment simply
 * get correctly-ordered ranks based on their real `checkInTime` values
 * (a database-generated timestamp), with `id` as a deterministic
 * tie-breaker for the rare same-millisecond case.
 */

function departmentCode(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "DPT").padEnd(3, "X");
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

interface QueueNumberInput {
  id: string;
  departmentId: string;
  departmentName: string;
  checkInTime: Date;
}

/**
 * Computes display queue numbers for a batch of entries in as few
 * queries as possible: one query per distinct (department, day) pair
 * actually present in the batch, rather than one per entry.
 */
export async function attachQueueNumbers<T extends QueueNumberInput>(
  entries: T[]
): Promise<Array<T & { queueNumber: string }>> {
  if (entries.length === 0) return [];

  // Group by department+day so we only query each scope once.
  const scopes = new Map<string, { departmentId: string; day: Date }>();
  for (const entry of entries) {
    const day = startOfDay(entry.checkInTime);
    const key = `${entry.departmentId}|${day.toISOString()}`;
    if (!scopes.has(key)) scopes.set(key, { departmentId: entry.departmentId, day });
  }

  // For each scope, fetch every entry that day (any status) ordered the
  // same way the number is defined, so rank is stable and complete.
  const ranksByScope = new Map<string, string[]>(); // key -> ordered ids
  for (const [key, { departmentId, day }] of scopes) {
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayEntries = await prisma.queueEntry.findMany({
      where: { departmentId, checkInTime: { gte: day, lt: dayEnd } },
      orderBy: [{ checkInTime: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    ranksByScope.set(
      key,
      dayEntries.map((e: { id: string }) => e.id)
    );
  }

  return entries.map((entry) => {
    const day = startOfDay(entry.checkInTime);
    const key = `${entry.departmentId}|${day.toISOString()}`;
    const orderedIds = ranksByScope.get(key) ?? [];
    const rank = orderedIds.indexOf(entry.id) + 1;
    const sequence = String(rank > 0 ? rank : orderedIds.length + 1).padStart(3, "0");
    return { ...entry, queueNumber: `${departmentCode(entry.departmentName)}-${sequence}` };
  });
}

/**
 * WAITING TIME (basic, actual elapsed — not the Phase 12 predictive
 * estimator). Minutes from check-in to when the patient was called, or
 * to now if they haven't been called yet. Once called, this number is a
 * fixed historical fact and does not keep changing.
 */
export function computeWaitingMinutes(checkInTime: Date, calledTime: Date | null): number {
  const end = calledTime ?? new Date();
  return Math.max(0, Math.round((end.getTime() - checkInTime.getTime()) / 60000));
}
