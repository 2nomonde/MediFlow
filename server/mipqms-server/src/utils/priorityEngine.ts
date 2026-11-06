import { TriagePriority, VulnerabilityCategory } from "@prisma/client";

/**
 * TRIAGE LEVEL → NUMERIC WEIGHT MAPPING (documented per the Phase 11
 * requirement). Higher clinical urgency maps to a higher number, which
 * is then multiplied by the configurable `triageWeight`. This mapping
 * itself is fixed (it's an ordering of the existing TriagePriority enum,
 * not a tunable value) — what's configurable is how much that ordering
 * matters relative to the other components, via PriorityConfig.
 */
export const TRIAGE_LEVEL_WEIGHTS: Record<TriagePriority, number> = {
  EMERGENCY: 5,
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export interface PriorityConfigValues {
  triageWeight: number;
  emergencyBonus: number;
  waitingTimeWeightPerMinute: number;
  appointmentOnTimeBonus: number;
  vulnerabilityBonus: number;
}

export interface PriorityCalculationInput {
  isEmergency: boolean;
  waitingMinutes: number;
  hasAppointment: boolean;
  vulnerabilityCategory: VulnerabilityCategory;
  triagePriorityLevel: TriagePriority | null;
}

export interface PriorityBreakdown {
  triageContribution: number;
  emergencyContribution: number;
  waitingTimeContribution: number;
  appointmentContribution: number;
  vulnerabilityContribution: number;
  /** Sum of the five contributions above — what the engine calculated. */
  calculatedScore: number;
}

/**
 * MANDATORY FORMULA (Phase 11):
 *
 *   priority_score =
 *       triage_weight * triage_level
 *     + emergency_flag * emergency_bonus
 *     + waiting_time_minutes * time_weight
 *     + appointment_bonus
 *     + vulnerability_bonus
 *
 * Every term is a plain multiplication or a flat bonus — no hidden
 * terms, no learned weights, nothing probabilistic. A queue entry with
 * no triage yet contributes 0 from the triage term (not a penalty, not
 * an assumption — simply "not yet assessed"), which is why
 * `triagePriorityLevel` is nullable here rather than defaulting to a
 * guessed level.
 */
export function calculatePriorityBreakdown(
  input: PriorityCalculationInput,
  config: PriorityConfigValues
): PriorityBreakdown {
  const triageContribution = input.triagePriorityLevel
    ? config.triageWeight * TRIAGE_LEVEL_WEIGHTS[input.triagePriorityLevel]
    : 0;

  const emergencyContribution = input.isEmergency ? config.emergencyBonus : 0;

  const waitingTimeContribution = input.waitingMinutes * config.waitingTimeWeightPerMinute;

  const appointmentContribution = input.hasAppointment ? config.appointmentOnTimeBonus : 0;

  const vulnerabilityContribution =
    input.vulnerabilityCategory !== VulnerabilityCategory.NONE ? config.vulnerabilityBonus : 0;

  const rawScore =
    triageContribution +
    emergencyContribution +
    waitingTimeContribution +
    appointmentContribution +
    vulnerabilityContribution;

  // Rounded to one decimal place purely for clean, consistent display —
  // the underlying arithmetic is otherwise untouched.
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    triageContribution: round1(triageContribution),
    emergencyContribution: round1(emergencyContribution),
    waitingTimeContribution: round1(waitingTimeContribution),
    appointmentContribution: round1(appointmentContribution),
    vulnerabilityContribution: round1(vulnerabilityContribution),
    calculatedScore: round1(rawScore),
  };
}
