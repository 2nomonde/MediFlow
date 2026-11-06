import { Badge } from "@/components/ui/Badge";
import type { PrescriptionStatus } from "@/types/prescription";

const CONFIG: Record<PrescriptionStatus, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "Pending", tone: "warning" },
  DISPENSED: { label: "Dispensed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const config = CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
