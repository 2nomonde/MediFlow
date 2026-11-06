import { Prisma, QueueStatus } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { attachQueueNumbers, computeWaitingMinutes } from "../utils/queueDisplay";
import { priorityService } from "./priority.service";
import type { CreateTriageInput, UpdateTriageInput, ListTriageQuery } from "../validators/triage.validators";

/**
 * Triage priority is one of the Phase 11 engine's inputs, so saving or
 * changing it is one of the documented recalculation triggers — this
 * refreshes the persisted QueueEntry.priorityScore right away rather
 * than waiting for the next explicit recalculate call or queue read.
 * Best-effort: a failure here must never fail the triage save itself
 * (the triage record is the source of truth; the cached score is a
 * convenience), so it's logged and swallowed, not thrown.
 */
async function recalculatePriorityBestEffort(queueEntryId: string): Promise<void> {
  try {
    await priorityService.recalculateAndPersist(queueEntryId);
  } catch (error) {
    console.error(`⚠️ Failed to recalculate priority after triage save for queue entry ${queueEntryId}:`, error);
  }
}

/**
 * "Requires triage" (Phase 10 business rule, since the schema has no
 * dedicated triage-status field): a queue entry whose status is WAITING
 * or CALLED and which has no linked Triage record yet. The presence of
 * that linked record IS the "has been triaged" signal — no new field
 * was needed. CALLED is included because a nurse may pull a patient
 * straight into triage once called, before any doctor involvement;
 * IN_CONSULTATION/COMPLETED/CANCELLED/NO_SHOW are excluded as no longer
 * relevant to a triage worklist.
 */
const TRIAGEABLE_STATUSES: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.CALLED];

const queueSummaryInclude = {
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
  },
  department: { select: { id: true, name: true } },
} satisfies Prisma.QueueEntryInclude;

const triageInclude = {
  queueEntry: { include: queueSummaryInclude },
  recordedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.TriageInclude;

type QueueEntryWithSummary = Prisma.QueueEntryGetPayload<{ include: typeof queueSummaryInclude }>;

/** Computed in application code, exactly as the schema comment on `Triage.bmi` documents — never in the database. */
function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function isDuplicateTriageConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.target as string[] | undefined)?.includes("queueEntryId") === true
  );
}

export const triageService = {
  /** GET /api/triage/pending */
  async listPending() {
    const entries = await prisma.queueEntry.findMany({
      where: { status: { in: TRIAGEABLE_STATUSES }, triage: null },
      include: queueSummaryInclude,
      orderBy: [{ isEmergency: "desc" }, { checkInTime: "asc" }, { id: "asc" }],
    });

    const withNumbers = await attachQueueNumbers(
      entries.map((e: QueueEntryWithSummary) => ({
        id: e.id,
        departmentId: e.departmentId,
        departmentName: e.department.name,
        checkInTime: e.checkInTime,
      }))
    );
    const numberById = new Map(withNumbers.map((e) => [e.id, e.queueNumber]));

    return entries.map((entry: QueueEntryWithSummary) => ({
      ...entry,
      queueNumber: numberById.get(entry.id) ?? "—",
      waitingMinutes: computeWaitingMinutes(entry.checkInTime, entry.calledTime),
    }));
  },

  /** GET /api/triage?priorityLevel=&page=&pageSize= — recent triage records. */
  async list(query: ListTriageQuery) {
    const { priorityLevel, page, pageSize } = query;
    const where: Prisma.TriageWhereInput = priorityLevel ? { priorityLevel } : {};

    const [total, records] = await prisma.$transaction([
      prisma.triage.count({ where }),
      prisma.triage.findMany({
        where,
        include: triageInclude,
        orderBy: [{ recordedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      records,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  },

  async getById(id: string) {
    const record = await prisma.triage.findUnique({ where: { id }, include: triageInclude });
    if (!record) throw ApiError.notFound("Triage record not found.");
    return record;
  },

  /** GET /api/triage/queue/:queueEntryId — lets the frontend decide create-vs-edit for a given queue entry. */
  async getByQueueEntry(queueEntryId: string) {
    const record = await prisma.triage.findUnique({ where: { queueEntryId }, include: triageInclude });
    if (!record) throw ApiError.notFound("No triage record exists for this queue entry yet.");
    return record;
  },

  async create(input: CreateTriageInput, recordedById: string) {
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: input.queueEntryId },
      include: { triage: true },
    });
    if (!queueEntry) throw ApiError.notFound("Queue entry not found.");
    if (queueEntry.triage) {
      throw ApiError.conflict("This queue entry already has a triage record.", {
        existingTriageId: queueEntry.triage.id,
      });
    }

    const { queueEntryId, ...clinicalFields } = input;
    const bmi = computeBmi(clinicalFields.weightKg as number | undefined, clinicalFields.heightCm as number | undefined);

    try {
      const created = await prisma.triage.create({
        data: { queueEntryId, recordedById, ...clinicalFields, bmi },
        include: triageInclude,
      });
      await recalculatePriorityBestEffort(queueEntryId as string);
      return created;
    } catch (error) {
      if (isDuplicateTriageConflict(error)) {
        // A concurrent triage submission for the same queue entry landed
        // between our pre-check and this insert — caught here by the
        // schema's own unique constraint on queueEntryId.
        throw ApiError.conflict("This queue entry already has a triage record.");
      }
      throw error;
    }
  },

  /**
   * Nurses may correct an existing triage record. The schema has no
   * updatedAt/updatedBy field on Triage, so an edit does not change who
   * is recorded as having performed the original triage
   * (`recordedById`/`recordedAt` stay as first written) — there is
   * currently no way to see that a record was later edited, which is a
   * real, documented limitation (see Phase10_Triage_Management.md,
   * Known Limitations) rather than something invented around here.
   */
  async update(id: string, input: UpdateTriageInput) {
    const existing = await prisma.triage.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Triage record not found.");

    const weightKg = input.weightKg ?? existing.weightKg ?? undefined;
    const heightCm = input.heightCm ?? existing.heightCm ?? undefined;
    const bmi = computeBmi(weightKg, heightCm);

    const updated = await prisma.triage.update({
      where: { id },
      data: { ...input, ...(bmi !== undefined ? { bmi } : {}) },
      include: triageInclude,
    });
    await recalculatePriorityBestEffort(existing.queueEntryId);
    return updated;
  },
};
