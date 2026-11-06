import { Badge } from "@/components/ui/Badge";
import type { AppointmentStatus } from "@/types/appointment";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  SCHEDULED: { label: "Scheduled", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "brand" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  NO_SHOW: { label: "No-show", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
