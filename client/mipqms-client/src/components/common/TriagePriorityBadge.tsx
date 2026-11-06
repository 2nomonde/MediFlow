import { Badge } from "@/components/ui/Badge";
import type { TriagePriority } from "@/types/triage";

/**
 * Color here is a visual aid for quickly scanning a list, not clinical
 * guidance — the label text is what actually conveys the level, and the
 * nurse's own assessment (not this component) is what determines it.
 */
const PRIORITY_CONFIG: Record<TriagePriority, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  EMERGENCY: { label: "Emergency", tone: "danger" },
  URGENT: { label: "Urgent", tone: "warning" },
  HIGH: { label: "High", tone: "warning" },
  NORMAL: { label: "Normal", tone: "neutral" },
  LOW: { label: "Low", tone: "success" },
};

export function TriagePriorityBadge({ priority }: { priority: TriagePriority }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
