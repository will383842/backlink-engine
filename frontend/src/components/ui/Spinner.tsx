import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

const Spinner: React.FC<SpinnerProps> = ({ size = "md", label, className = "" }) => {
  const sizeClass = SIZE_CLASSES[size];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-surface-500 ${className}`}
    >
      <Loader2 className={`${sizeClass} animate-spin`} aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
};

export default Spinner;
