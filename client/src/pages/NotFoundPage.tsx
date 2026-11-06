import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="font-display text-4xl font-bold text-navy-900">404</p>
      <p className="text-slate-500">This page doesn't exist.</p>
      <Link to="/dashboard">
        <Button variant="secondary" size="sm" className="mt-2">
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}
