import { Prisma, UserRole, TriagePriority, AuditAction } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { calculatePriorityBreakdown, type PriorityBreakdown } from "../utils/priorityEngine";
import { priorityConfigService } from "./priorityConfig.service";
import { computeWaitingMinutes } from "../utils/queueDisplay";
import type { OverridePriorityInput } from "../validators/priorityOverride.validators";

const priorityContextInclude = {
  patient: { select: { vulnerabilityCategory: true } },
  triage: { select: { priorityLevel: true } },
  priorityOverriddenBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.QueueEntryInclude;

type QueueEntryWithPriorityContext = Prisma.QueueEntryGetPayload<{ include: typeof priorityContextInclude }>;

export interface FullPriorityInfo {
  breakdown: PriorityBreakdown;
  triagePriority: TriagePriority | null;
  hasManualOverride: boolean;
  manualOverride: number | null;
  overrideReason: string | null;
  overriddenBy: { id: string; firstName: string; lastName: string } | null;
  overriddenAt: string | null;
  effectivePriority: number;
}

/**
 * Computes the full, explainable priority picture for one queue entry —
 * live, from current data. This does NOT persist anything; see
 * `recalculateAndPersist` for the write path. Used by queue.service.ts
 * to enrich every queue response without an extra round trip per call
 * (config is fetched once by the caller and passed in).
 */
export async function computeFullPriority(
  entry: QueueEntryWithPriorityContext,
  configValues: Awaited<ReturnType<typeof priorityConfigService.getActiveValues>>
): Promise<FullPriorityInfo> {
  const waitingMinutes = computeWaitingMinutes(entry.checkInTime, entry.calledTime);

  const breakdown = calculatePriorityBreakdown(
    {
      isEmergency: entry.isEmergency,
      waitingMinutes,
      hasAppointment: entry.appointmentId !== null,
      vulnerabilityCategory: entry.patient.vulnerabilityCategory,
      triagePriorityLevel: entry.triage?.priorityLevel ?? null,
    },
    configValues
  );

  const hasManualOverride = entry.manualPriorityOverride !== null;

  return {
    breakdown,
    triagePriority: entry.triage?.priorityLevel ?? null,
    hasManualOverride,
    manualOverride: entry.manualPriorityOverride,
    overrideReason: entry.manualPriorityReason,
    overriddenBy: entry.priorityOverriddenBy,
    overriddenAt: entry.priorityOverriddenAt ? entry.priorityOverriddenAt.toISOString() : null,
    // The displayed/actionable priority: a clinician's override wins when
    // present, otherwise the engine's calculated score — never silently
    // merged or averaged, so the distinction stays visible (hasManualOverride).
    effectivePriority: hasManualOverride ? (entry.manualPriorityOverride as number) : breakdown.calculatedScore,
  };
}

async function loadEntryWithContext(queueEntryId: string): Promise<QueueEntryWithPriorityContext> {
  const entry = await prisma.queueEntry.findUnique({
    where: { id: queueEntryId },
    include: priorityContextInclude,
  });
  if (!entry) throw ApiError.notFound("Queue entry not found.");
  return entry;
}

export const priorityService = {
  /** GET /api/queue/:id/priority — full breakdown, no persistence. */
  async getBreakdown(queueEntryId: string): Promise<FullPriorityInfo> {
    const entry = await loadEntryWithContext(queueEntryId);
    const config = await priorityConfigService.getActiveValues();
    return computeFullPriority(entry, config);
  },

  /**
   * POST /api/queue/:id/priority/recalculate — computes fresh and
   * PERSISTS `priorityScore`/`priorityCalculatedAt` on the QueueEntry.
   * This is one of the few write-triggers for those two fields (see
   * Phase11 doc, "When Priority Is Persisted" for the full list) — plain
   * GETs never write, by design.
   */
  async recalculateAndPersist(queueEntryId: string): Promise<FullPriorityInfo> {
    const entry = await loadEntryWithContext(queueEntryId);
    const config = await priorityConfigService.getActiveValues();
    const info = await computeFullPriority(entry, config);

    await prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: { priorityScore: info.breakdown.calculatedScore, priorityCalculatedAt: new Date() },
    });

    return info;
  },

  /**
   * POST /api/queue/:id/priority/override — records a clinician's
   * override. `priorityScore` (the engine's own figure) is refreshed
   * alongside it but never overwritten by the override value itself —
   * the two stay distinguishable, per the Phase 11 requirement.
   */
  async override(
    queueEntryId: string,
    input: OverridePriorityInput,
    actingUser: { id: string; role: UserRole }
  ): Promise<FullPriorityInfo> {
    if (actingUser.role === UserRole.RECEPTIONIST || actingUser.role === UserRole.PHARMACIST) {
      // Defense in depth — route-level requireRole already blocks this,
      // but the rule is repeated here so it can never be bypassed by a
      // future route wired up without the right role list.
      throw ApiError.forbidden("This role is not permitted to override queue priority.");
    }

    const entry = await loadEntryWithContext(queueEntryId);
    const config = await priorityConfigService.getActiveValues();
    const freshBreakdown = calculatePriorityBreakdown(
      {
        isEmergency: entry.isEmergency,
        waitingMinutes: computeWaitingMinutes(entry.checkInTime, entry.calledTime),
        hasAppointment: entry.appointmentId !== null,
        vulnerabilityCategory: entry.patient.vulnerabilityCategory,
        triagePriorityLevel: entry.triage?.priorityLevel ?? null,
      },
      config
    );

    const updated = await prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        priorityScore: freshBreakdown.calculatedScore,
        priorityCalculatedAt: new Date(),
        manualPriorityOverride: input.overrideValue,
        manualPriorityReason: input.reason,
        priorityOverriddenById: actingUser.id,
        priorityOverriddenAt: new Date(),
      },
      include: priorityContextInclude,
    });

    // The QueueEntry fields above hold only the CURRENT override — a
    // second override later would silently replace the first one's
    // value/reason with no trace. Writing an AuditLog row (the schema
    // already has a PRIORITY_OVERRIDE action defined for exactly this)
    // preserves that history without building the full Phase 15 audit
    // module — just this one write, using the model as-is.
    await prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: AuditAction.PRIORITY_OVERRIDE,
        entityType: "QueueEntry",
        entityId: queueEntryId,
        queueEntryId,
        previousValue: {
          calculatedScore: freshBreakdown.calculatedScore,
          priorOverride: entry.manualPriorityOverride ?? null,
          priorOverrideReason: entry.manualPriorityReason ?? null,
        },
        newValue: { overrideValue: input.overrideValue },
        reason: input.reason,
        description: `Priority manually overridden to ${input.overrideValue} (engine calculated ${freshBreakdown.calculatedScore}).`,
      },
    });

    return computeFullPriority(updated, config);
  },
};
