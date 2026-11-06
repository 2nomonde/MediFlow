import { PriorityConfig, AuditAction } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import type { PriorityConfigValues } from "../utils/priorityEngine";
import type { UpdatePriorityConfigInput } from "../validators/priorityConfig.validators";

/**
 * Matches the schema's own `@default` values on PriorityConfig exactly.
 * Used only as an in-memory fallback if, somehow, no active config row
 * exists at runtime (shouldn't happen — the seed script creates one) —
 * so the engine degrades to sensible defaults instead of crashing.
 */
const FALLBACK_CONFIG: PriorityConfigValues = {
  triageWeight: 10,
  emergencyBonus: 1000,
  waitingTimeWeightPerMinute: 1,
  appointmentOnTimeBonus: 20,
  vulnerabilityBonus: 15,
};

export const priorityConfigService = {
  /** Returns the active config, or a documented in-memory fallback with a logged warning if none is persisted. */
  async getActiveValues(): Promise<PriorityConfigValues> {
    const active = await prisma.priorityConfig.findFirst({ where: { isActive: true } });
    if (!active) {
      console.warn(
        "⚠️ No active PriorityConfig found in the database — using built-in fallback defaults. Run the seed script to persist one."
      );
      return FALLBACK_CONFIG;
    }
    return {
      triageWeight: active.triageWeight,
      emergencyBonus: active.emergencyBonus,
      waitingTimeWeightPerMinute: active.waitingTimeWeightPerMinute,
      appointmentOnTimeBonus: active.appointmentOnTimeBonus,
      vulnerabilityBonus: active.vulnerabilityBonus,
    };
  },

  /** Full active config record (ADMIN config screen — includes id/name/timestamps, not just the five values). */
  async getActive(): Promise<PriorityConfig> {
    const active = await prisma.priorityConfig.findFirst({ where: { isActive: true } });
    if (!active) {
      throw ApiError.notFound(
        "No active priority configuration exists. Run the database seed script to create the default one."
      );
    }
    return active;
  },

  async updateActive(input: UpdatePriorityConfigInput, updatedById: string): Promise<PriorityConfig> {
    const active = await this.getActive();
    const updated = await prisma.priorityConfig.update({
      where: { id: active.id },
      data: { ...input, updatedById },
    });

    // Config changes affect every future score calculation clinic-wide —
    // a rare, deliberate admin action worth the same one-row AuditLog
    // treatment as an override (schema already has CONFIG_UPDATED
    // defined for this; no new mechanism built).
    await prisma.auditLog.create({
      data: {
        userId: updatedById,
        action: AuditAction.CONFIG_UPDATED,
        entityType: "PriorityConfig",
        entityId: active.id,
        previousValue: {
          triageWeight: active.triageWeight,
          emergencyBonus: active.emergencyBonus,
          waitingTimeWeightPerMinute: active.waitingTimeWeightPerMinute,
          appointmentOnTimeBonus: active.appointmentOnTimeBonus,
          vulnerabilityBonus: active.vulnerabilityBonus,
        },
        newValue: input,
        description: "Priority configuration weights updated.",
      },
    });

    return updated;
  },
};
