import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className = "",
}) => {
  if (totalPages <= 1) {
    return total !== undefined ? (
      <div className={`flex items-center justify-end text-xs text-surface-500 ${className}`}>
        {total} {total === 1 ? "item" : "items"}
      </div>
    ) : null;
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={`flex items-center justify-between gap-3 text-xs text-surface-600 ${className}`}
    >
      <div>
        {total !== undefined && pageSize !== undefined ? (
          <>
            Page {page} / {totalPages} — {total} total
          </>
        ) : (
          <>
            Page {page} / {totalPages}
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-1 text-surface-700 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          type="button"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-1 text-surface-700 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
