import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({ size = "md", className, label = "Loading" }: LoadingSpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("animate-spin text-brand-600", SIZE_CLASSES[size], className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
