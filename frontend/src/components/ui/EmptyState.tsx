import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-200 bg-surface-50 p-10 text-center ${className}`}
    >
      <div className="mb-3 text-surface-400">
        {icon ?? <Inbox size={40} strokeWidth={1.5} />}
      </div>
      <h3 className="text-sm font-semibold text-surface-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-surface-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
