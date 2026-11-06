import { useEffect, useRef, useState } from "react";
import { ChevronDown, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RoleBadge } from "@/components/common/RoleBadge";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (!user) return null;

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block font-medium text-navy-900">
            {user.firstName} {user.lastName}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-slate-200 bg-white py-2 shadow-panel"
        >
          <div className="border-b border-slate-100 px-4 pb-3">
            <p className="font-medium text-navy-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="mb-2 truncate text-xs text-slate-500">{user.email}</p>
            <RoleBadge role={user.role} />
          </div>
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-400"
            title="Coming in a later phase"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              void logout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
