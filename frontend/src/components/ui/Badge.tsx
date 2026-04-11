import React from "react";

type BadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-surface-100 text-surface-700 ring-surface-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
};

const SIZE_CLASSES = {
  sm: "text-[11px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  children,
  className = "",
  icon,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};

export default Badge;
