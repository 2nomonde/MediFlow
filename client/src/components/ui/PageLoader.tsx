import { LoadingSpinner } from "./LoadingSpinner";

interface PageLoaderProps {
  label?: string;
}

/** Full-viewport loading state, used e.g. while the initial session check runs. */
export function PageLoader({ label = "Loading MediFlow..." }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <LoadingSpinner size="lg" label={label} />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
