/** Mirrors the Prisma `PriorityConfig` model exactly — the formula's five configurable weights. */
export interface PriorityConfig {
  id: string;
  name: string;
  isActive: boolean;
  triageWeight: number;
  emergencyBonus: number;
  waitingTimeWeightPerMinute: number;
  appointmentOnTimeBonus: number;
  vulnerabilityBonus: number;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdatePriorityConfigInput = Partial<
  Pick<PriorityConfig, "triageWeight" | "emergencyBonus" | "waitingTimeWeightPerMinute" | "appointmentOnTimeBonus" | "vulnerabilityBonus">
>;
