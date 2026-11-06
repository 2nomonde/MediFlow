import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { getNavForRole } from "@/utils/roleNav";
import { cn } from "@/utils/cn";
import type { UserRole } from "@/types/auth";

interface SidebarProps {
  role: UserRole;
  /** Mobile drawer state — desktop ignores these and is always visible. */
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const items = getNavForRole(role);

  const content = (
    <>
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Logo />
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-navy-900"
                )
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </span>
              {!item.implemented && (
                <Lock className="h-3.5 w-3.5 text-slate-300" aria-label="Not yet available" />
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-400">M-IPQMS · Mtubatuba</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / tablet: static sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {content}
      </aside>

      {/* Mobile: drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={onClose} aria-hidden="true" />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-white shadow-panel">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
