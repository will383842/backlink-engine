// ---------------------------------------------------------------------------
// ScoreBadge – Circular score indicator with color coding
// ---------------------------------------------------------------------------

import React from "react";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "w-7 h-7 text-xs",
  md: "w-10 h-10 text-sm font-medium",
  lg: "w-14 h-14 text-lg font-semibold",
};

function getColorClasses(score: number): string {
  if (!score || score === 0) {
    return "bg-gray-100 text-gray-500 border-gray-300";
  }
  if (score >= 70) {
    return "bg-green-50 text-green-700 border-green-400";
  }
  if (score >= 40) {
    return "bg-yellow-50 text-yellow-700 border-yellow-400";
  }
  return "bg-red-50 text-red-700 border-red-400";
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, size = "md" }) => {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const colorClass = getColorClasses(score);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full border-2 ${sizeClass} ${colorClass}`}
      title={`Score: ${score}`}
    >
      {score || "--"}
    </div>
  );
};

export default ScoreBadge;
