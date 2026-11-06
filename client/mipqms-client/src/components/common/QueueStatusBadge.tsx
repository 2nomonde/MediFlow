import { Badge } from "@/components/ui/Badge";
import type { QueueStatus } from "@/types/queue";

const STATUS_CONFIG: Record<QueueStatus, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  WAITING: { label: "Waiting", tone: "warning" },
  CALLED: { label: "Called", tone: "brand" },
  IN_CONSULTATION: { label: "In consultation", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  NO_SHOW: { label: "No-show", tone: "danger" },
};

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
