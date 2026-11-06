import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/config/navigation";
import type { UserRole } from "@/types/auth";

const ROLE_TONE: Record<UserRole, "brand" | "success" | "warning" | "danger" | "neutral"> = {
  ADMIN: "brand",
  RECEPTIONIST: "neutral",
  NURSE: "success",
  DOCTOR: "brand",
  PHARMACIST: "warning",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Badge>;
}
