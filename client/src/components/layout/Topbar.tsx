import { Menu, Bell } from "lucide-react";
import { UserMenu } from "./UserMenu";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-md p-2 text-slate-500 hover:bg-slate-50 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-label="Notifications (coming in a later phase)"
          title="Coming in a later phase"
          className="relative rounded-md p-2 text-slate-400"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
