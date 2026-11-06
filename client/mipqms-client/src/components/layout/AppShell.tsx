import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/hooks/useAuth";

/**
 * The shell every authenticated page renders inside: sidebar + topbar +
 * content area. Works across all future modules — a new page is just a
 * new <Route> whose element renders inside this shell's <Outlet />,
 * nothing here needs to change.
 */
export function AppShell() {
  const { user } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
