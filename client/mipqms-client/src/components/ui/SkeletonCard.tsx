import { cn } from "@/utils/cn";

/** Placeholder card shown while real content (future phases' API data) is loading. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-card border border-slate-200 bg-white p-5",
        className
      )}
      aria-hidden="true"
    >
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-4 h-7 w-16 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
    </div>
  );
}
