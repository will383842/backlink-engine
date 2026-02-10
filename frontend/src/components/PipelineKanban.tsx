// ---------------------------------------------------------------------------
// PipelineKanban – Drag-and-drop kanban board for prospect pipeline
// Uses native HTML Drag and Drop API (no external library).
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import ScoreBadge from "@/components/ScoreBadge";
import { useProspects, useUpdateProspect } from "@/hooks/useApi";
import type { Prospect, ProspectStatus } from "@/types";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface KanbanColumn {
  id: ProspectStatus;
  labelKey: string;
  color: string; // Tailwind header bg color
}

const COLUMNS: KanbanColumn[] = [
  { id: "NEW", labelKey: "kanban.new", color: "bg-surface-200" },
  { id: "READY_TO_CONTACT", labelKey: "kanban.readyToContact", color: "bg-blue-200" },
  { id: "CONTACTED_EMAIL", labelKey: "kanban.contactedEmail", color: "bg-blue-300" },
  { id: "CONTACTED_MANUAL", labelKey: "kanban.contactedManual", color: "bg-blue-300" },
  { id: "REPLIED", labelKey: "kanban.replied", color: "bg-yellow-200" },
  { id: "NEGOTIATING", labelKey: "kanban.negotiating", color: "bg-orange-200" },
  { id: "WON", labelKey: "kanban.won", color: "bg-green-200" },
];

// ---------------------------------------------------------------------------
// Country flag emoji helper
// ---------------------------------------------------------------------------

function countryFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const offset = 0x1f1e6;
  const a = countryCode.toUpperCase().charCodeAt(0) - 65 + offset;
  const b = countryCode.toUpperCase().charCodeAt(1) - 65 + offset;
  return String.fromCodePoint(a) + String.fromCodePoint(b);
}

// ---------------------------------------------------------------------------
// Kanban card
// ---------------------------------------------------------------------------

interface CardProps {
  prospect: Prospect;
  isDragged?: boolean;
  onDragStart: (e: React.DragEvent, prospectId: number) => void;
  onDragEnd: () => void;
  onClick: (prospectId: number) => void;
}

const KanbanCard: React.FC<CardProps> = ({ prospect, isDragged, onDragStart, onDragEnd, onClick }) => {
  const lastEventDate = prospect.lastContactedAt ?? prospect.updatedAt;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, prospect.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(prospect.id)}
      className={`cursor-pointer rounded-lg border border-surface-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:shadow-lg ${isDragged ? "opacity-50" : ""}`}
    >
      {/* Domain + score */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-surface-900">
          {prospect.domain}
        </span>
        <ScoreBadge score={prospect.score} size="sm" />
      </div>

      {/* Country flag + last event date */}
      <div className="mt-2 flex items-center justify-between text-xs text-surface-500">
        <span>
          {prospect.country ? (
            <>
              {countryFlag(prospect.country)}{" "}
              <span className="uppercase">{prospect.country}</span>
            </>
          ) : (
            <span className="text-surface-300">--</span>
          )}
        </span>

        {lastEventDate && (
          <time dateTime={lastEventDate} className="text-surface-400">
            {format(new Date(lastEventDate), "dd MMM")}
          </time>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PipelineKanban: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: prospectData, isLoading } = useProspects({ limit: 500 });
  const updateProspect = useUpdateProspect();

  const [dragOverColumn, setDragOverColumn] = useState<ProspectStatus | null>(null);
  const [draggedProspectId, setDraggedProspectId] = useState<number | null>(null);

  // Group prospects by status
  const prospectsByStatus = useMemo(() => {
    const grouped: Record<string, Prospect[]> = {};
    for (const col of COLUMNS) {
      grouped[col.id] = [];
    }
    if (prospectData?.data) {
      for (const prospect of prospectData.data) {
        if (grouped[prospect.status]) {
          grouped[prospect.status].push(prospect);
        }
      }
    }
    return grouped;
  }, [prospectData]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, prospectId: number) => {
      setDraggedProspectId(prospectId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(prospectId));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: ProspectStatus) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverColumn(columnId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStatus: ProspectStatus) => {
      e.preventDefault();
      setDragOverColumn(null);

      const prospectId = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!prospectId || isNaN(prospectId)) return;

      // Find prospect's current status
      const prospect = prospectData?.data.find((p) => p.id === prospectId);
      if (!prospect || prospect.status === targetStatus) return;

      // Optimistically update
      updateProspect.mutate({ id: prospectId, data: { status: targetStatus } });

      setDraggedProspectId(null);
    },
    [prospectData, updateProspect],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedProspectId(null);
    setDragOverColumn(null);
  }, []);

  const handleCardClick = useCallback(
    (prospectId: number) => {
      navigate(`/prospects/${prospectId}`);
    },
    [navigate],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="ml-3 text-sm text-surface-500">{t("kanban.loadingPipeline")}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const prospects = prospectsByStatus[column.id] ?? [];
        const isDragOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`flex w-64 flex-shrink-0 flex-col rounded-xl border transition-colors ${
              isDragOver
                ? "border-brand-400 bg-brand-50"
                : "border-surface-200 bg-surface-50"
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div
              className={`flex items-center justify-between rounded-t-xl px-3 py-2 ${column.color}`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-700">
                {t(column.labelKey)}
              </h3>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/60 px-1.5 text-xs font-medium text-surface-700">
                {prospects.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-2" style={{ minHeight: 120 }}>
              {prospects.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-surface-400">
                  {t("kanban.noProspects")}
                </div>
              ) : (
                prospects.map((prospect) => (
                  <KanbanCard
                    key={prospect.id}
                    prospect={prospect}
                    isDragged={draggedProspectId === prospect.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={handleCardClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineKanban;
