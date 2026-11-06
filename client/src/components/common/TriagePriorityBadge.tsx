import { Badge } from "@/components/ui/Badge";
import type { TriagePriority } from "@/types/triage";

/**
 * Color here is a visual aid for quickly scanning a list, not clinical
 * guidance — the label text is what actually conveys the level, and the
 * nurse's own assessment (not this component) is what determines it.
 *
 * Phase 11 mapping: Emergency→red/danger, Urgent/High→amber/orange
 * (the design system's Badge component has one "warning" tone rather
 * than separate orange/amber tones — both map to it, documented here
 * rather than adding a sixth tone for a distinction the rest of the
 * app doesn't otherwise make), Normal→blue/brand, Low→green/success.
 */
const PRIORITY_CONFIG: Record<TriagePriority, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  EMERGENCY: { label: "Emergency", tone: "danger" },
  URGENT: { label: "Urgent", tone: "warning" },
  HIGH: { label: "High", tone: "warning" },
  NORMAL: { label: "Normal", tone: "brand" },
  LOW: { label: "Low", tone: "success" },
};

export function TriagePriorityBadge({ priority }: { priority: TriagePriority }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
