import { NAV_ITEMS, type NavItem } from "@/config/navigation";
import type { UserRole } from "@/types/auth";

/**
 * Returns the nav items a given role should see. Purely a UX filter —
 * repeated here as a reminder that hiding a link is not the same as
 * protecting the route or the API behind it (that's `RoleRoute` and the
 * Phase 4 backend `requireRole` middleware, respectively).
 */
export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
