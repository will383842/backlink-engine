import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  FileText,
  Link2,
  Trophy,
  RefreshCcw,
  Send,
  Clock,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Prospect, Backlink } from "@/types";
import EnrollPreview from "./EnrollPreview";

interface ProspectTimelineEvent {
  id: number;
  eventType: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-surface-100 text-surface-700",
  ENRICHING: "bg-blue-100 text-blue-700",
  READY_TO_CONTACT: "bg-cyan-100 text-cyan-700",
  CONTACTED_EMAIL: "bg-indigo-100 text-indigo-700",
  CONTACTED_MANUAL: "bg-indigo-100 text-indigo-700",
  FOLLOWUP_DUE: "bg-amber-100 text-amber-700",
  REPLIED: "bg-purple-100 text-purple-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LINK_PENDING: "bg-blue-100 text-blue-700",
  LINK_VERIFIED: "bg-emerald-100 text-emerald-700",
  LINK_LOST: "bg-red-100 text-red-700",
  RE_CONTACTED: "bg-purple-100 text-purple-700",
  LOST: "bg-red-100 text-red-700",
  DO_NOT_CONTACT: "bg-surface-800 text-white",
};

// ---------------------------------------------------------------------------
// Inline editable field component
// ---------------------------------------------------------------------------

function InlineEdit({
  value,
  placeholder,
  onSave,
  isLink,
}: {
  value: string | null;
  placeholder: string;
  onSave: (newValue: string | null) => void;
  isLink?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleSave() {
    const trimmed = editValue.trim();
    onSave(trimmed || null);
    setEditing(false);
  }

  function handleCancel() {
    setEditValue(value ?? "");
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input-field py-1 text-sm"
          placeholder={placeholder}
        />
        <button
          onClick={handleSave}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
          title="Save"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-surface-400 hover:bg-surface-100"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5">
      {value ? (
        isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-600 hover:underline"
          >
            {value} <ExternalLink size={12} />
          </a>
        ) : (
          <span className="text-surface-900">{value}</span>
        )
      ) : (
        <span className="text-surface-400">{placeholder}</span>
      )}
      <button
        onClick={() => {
          setEditValue(value ?? "");
          setEditing(true);
        }}
        className="rounded p-1 text-surface-300 opacity-0 transition-opacity hover:bg-surface-100 hover:text-surface-500 group-hover:opacity-100"
        title="Edit"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  const { data: prospect, isLoading } = useQuery<Prospect>({
    queryKey: ["prospect", numericId],
    queryFn: async () => {
      const res = await api.get(`/prospects/${numericId}`);
      return res.data.data ?? res.data;
    },
    enabled: numericId > 0,
  });

  const { data: timeline } = useQuery<ProspectTimelineEvent[]>({
    queryKey: ["prospect-timeline", numericId],
    queryFn: async () => {
      const res = await api.get(`/prospects/${numericId}/timeline`);
      return res.data.data ?? res.data;
    },
    enabled: numericId > 0,
  });

  const { data: backlinks } = useQuery<Backlink[]>({
    queryKey: ["prospect-backlinks", numericId],
    queryFn: async () => {
      const res = await api.get(`/prospects/${numericId}/backlinks`);
      return res.data.data ?? res.data;
    },
    enabled: numericId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Prospect>) => {
      const res = await api.put(`/prospects/${numericId}`, updates);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success("Prospect updated");
    },
  });

  const markWonMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${numericId}/mark-won`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success("Prospect marked as WON");
    },
  });

  const recontactMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${numericId}/recontact`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success("Recontact scheduled");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="card text-center text-surface-500">
        Prospect not found.
      </div>
    );
  }

  const firstContact = prospect.contacts?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/prospects")}
            className="btn-secondary"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-surface-900">
                {prospect.domain}
              </h2>
              <span className={`badge ${STATUS_COLORS[prospect.status] ?? "bg-surface-100 text-surface-700"}`}>
                {prospect.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-surface-500">
              <span>Score: {prospect.score}</span>
              <span>DA: {prospect.mozDa ?? "N/A"}</span>
              <span>Tier: {prospect.tier ? `T${prospect.tier}` : "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="btn-primary"
          >
            <Send size={16} className="mr-1.5" /> Enroll
          </button>
          <button
            onClick={() => markWonMutation.mutate()}
            disabled={markWonMutation.isPending}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700"
          >
            <Trophy size={16} className="mr-1.5" /> Mark WON
          </button>
          <button
            onClick={() => recontactMutation.mutate()}
            disabled={recontactMutation.isPending}
            className="btn-secondary"
          >
            <RefreshCcw size={16} className="mr-1.5" /> Recontact
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
            <Mail size={16} /> Contact Info
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-surface-500">Email</dt>
              <dd>
                <InlineEdit
                  value={firstContact?.email ?? null}
                  placeholder="Not set (click to edit)"
                  onSave={(val) => {
                    // Contacts are separate, but update via prospect endpoint
                    updateMutation.mutate({ contactFormUrl: prospect.contactFormUrl } as Partial<Prospect>);
                    // If API supports email update on prospect:
                    if (val !== null) {
                      api.put(`/prospects/${numericId}`, { email: val });
                      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
                    }
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-surface-500">Contact Name</dt>
              <dd>
                <InlineEdit
                  value={firstContact?.name ?? null}
                  placeholder="Not set (click to edit)"
                  onSave={(val) => {
                    api.put(`/prospects/${numericId}`, { name: val }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
                      toast.success("Contact name updated");
                    });
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-surface-500">Contact Form URL</dt>
              <dd>
                <InlineEdit
                  value={prospect.contactFormUrl}
                  placeholder="Not set (click to edit)"
                  onSave={(val) => updateMutation.mutate({ contactFormUrl: val } as Partial<Prospect>)}
                  isLink
                />
              </dd>
            </div>
          </dl>
        </div>

        {/* Enrichment data */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
            <FileText size={16} /> Enrichment Data
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium text-surface-500">Country</dt>
                <dd className="text-surface-900">
                  {prospect.country ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">Language</dt>
                <dd className="text-surface-900">
                  {prospect.language ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">Source</dt>
                <dd className="text-surface-900">{prospect.source}</dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">Spam Score</dt>
                <dd className="text-surface-900">{prospect.spamScore}</dd>
              </div>
            </div>
            <div>
              <dt className="font-medium text-surface-500">
                Neighborhood Score
              </dt>
              <dd className="text-surface-900">
                {prospect.linkNeighborhoodScore !== null
                  ? `${prospect.linkNeighborhoodScore}/100`
                  : "Not analyzed"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
          <Clock size={16} /> Timeline
        </h3>
        {!timeline?.length ? (
          <p className="text-sm text-surface-400">No events yet.</p>
        ) : (
          <div className="space-y-3">
            {timeline.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 border-l-2 border-surface-200 pl-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-900">
                    {event.eventType.replace(/_/g, " ")}
                  </p>
                  {event.data && (
                    <p className="text-xs text-surface-500">
                      {JSON.stringify(event.data)}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-surface-400">
                  {format(new Date(event.createdAt), "dd MMM yyyy HH:mm")}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backlinks */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
          <Link2 size={16} /> Backlinks
        </h3>
        {!backlinks?.length ? (
          <p className="text-sm text-surface-400">No backlinks recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-200">
                <tr>
                  <th className="pb-2 font-medium text-surface-500">Target</th>
                  <th className="pb-2 font-medium text-surface-500">Anchor</th>
                  <th className="pb-2 font-medium text-surface-500">Type</th>
                  <th className="pb-2 font-medium text-surface-500">Live</th>
                  <th className="pb-2 font-medium text-surface-500">
                    First Detected
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {backlinks.map((bl) => (
                  <tr key={bl.id}>
                    <td className="py-2 text-surface-900">{bl.targetUrl}</td>
                    <td className="py-2 text-surface-700">{bl.anchorText}</td>
                    <td className="py-2">
                      <span className="badge bg-brand-50 text-brand-700">
                        {bl.linkType}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          bl.isLive ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="py-2 text-xs text-surface-500">
                      {bl.firstDetectedAt
                        ? format(new Date(bl.firstDetectedAt), "dd MMM yyyy")
                        : bl.createdAt
                          ? format(new Date(bl.createdAt), "dd MMM yyyy")
                          : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll modal */}
      {enrollModalOpen && prospect && (
        <EnrollPreview
          prospectId={String(prospect.id)}
          prospectDomain={prospect.domain}
          onClose={() => setEnrollModalOpen(false)}
        />
      )}
    </div>
  );
}
