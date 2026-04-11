import React from "react";
import { Link } from "react-router-dom";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  to?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "flat";
  };
  accent?: "brand" | "success" | "warning" | "danger" | "neutral";
  className?: string;
}

const ACCENT_CLASSES: Record<NonNullable<StatsCardProps["accent"]>, string> = {
  brand: "text-brand-600",
  success: "text-green-600",
  warning: "text-yellow-600",
  danger: "text-red-600",
  neutral: "text-surface-700",
};

const TREND_CLASSES: Record<"up" | "down" | "flat", string> = {
  up: "text-green-600",
  down: "text-red-600",
  flat: "text-surface-500",
};

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  hint,
  to,
  trend,
  accent = "neutral",
  className = "",
}) => {
  const content = (
    <div
      className={`rounded-xl border border-surface-200 bg-white p-4 transition hover:shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-surface-500">
            {label}
          </p>
          <p className={`mt-1 text-2xl font-semibold ${ACCENT_CLASSES[accent]}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${TREND_CLASSES[trend.direction]}`}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && <div className="shrink-0 text-surface-400">{icon}</div>}
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

export default StatsCard;
