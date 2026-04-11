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
  ChevronDown,
  ChevronUp,
  Inbox,
  Target,
  Tags,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Prospect, Backlink, Tag } from "@/types";
import EnrollPreview from "@/components/prospects/EnrollPreview";
import ProspectNotes from "@/components/ProspectNotes";
import { useTranslation } from "@/i18n";

// Extend Prospect with v2 fields that may not yet be in the shared types
interface ProspectWithV2 extends Prospect {
  opportunityType?: string | null;
  opportunityNotes?: string | null;
  thematicRelevance?: number | null;
  thematicCategories?: string[] | null;
}

interface ProspectTimelineEvent {
  id: number;
  eventType: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

interface SentEmailRecord {
  id: number;
  stepNumber: number;
  subject: string;
  body: string;
  status: string;
  sentAt: string;
  language: string;
  generatedBy: string;
  openCount: number;
  clickCount: number;
  abVariant: string | null;
}

const EMAIL_STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  delivered: "bg-cyan-100 text-cyan-700",
  opened: "bg-emerald-100 text-emerald-700",
  clicked: "bg-purple-100 text-purple-700",
  bounced: "bg-red-100 text-red-700",
  complained: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const OPPORTUNITY_TYPE_COLORS: Record<string, string> = {
  guest_post: "bg-violet-100 text-violet-700",
  resource_link: "bg-cyan-100 text-cyan-700",
  mention: "bg-amber-100 text-amber-700",
  partnership: "bg-emerald-100 text-emerald-700",
  affiliate: "bg-pink-100 text-pink-700",
  interview: "bg-indigo-100 text-indigo-700",
  guest_content: "bg-violet-100 text-violet-700",
  broken_link: "bg-orange-100 text-orange-700",
  skyscraper: "bg-blue-100 text-blue-700",
  infographic: "bg-teal-100 text-teal-700",
};

const THEME_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
];

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
  const { t } = useTranslation();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<number | null>(null);

  const { data: prospect, isLoading } = useQuery<ProspectWithV2>({
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

  const { data: sentEmails } = useQuery<SentEmailRecord[]>({
    queryKey: ["prospect-sent-emails", numericId],
    queryFn: async () => {
      const res = await api.get(`/sent-emails/prospect/${numericId}`);
      return res.data.data ?? res.data;
    },
    enabled: numericId > 0,
  });

  // Fetch all tags for tag selector
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await api.get("/tags");
      return res.data;
    },
  });

  const allTags = (tagsData?.tags ?? []) as Tag[];

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Prospect>) => {
      const res = await api.put(`/prospects/${numericId}`, updates);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success(t("prospectDetail.prospectUpdated"));
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tagIds: number[]) => {
      await api.post(`/tags/prospects/${numericId}`, { tagIds });
    },
    onSuccess: () => {
      toast.success("✅ Tags mis à jour !");
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      setShowTagModal(false);
    },
    onError: () => {
      toast.error("❌ Erreur lors de la mise à jour des tags");
    },
  });

  const markWonMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${numericId}/mark-won`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success(t("prospectDetail.prospectMarkedWon"));
    },
  });

  const recontactMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${numericId}/recontact`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
      toast.success(t("prospectDetail.recontactScheduled"));
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
        {t("prospects.notFound")}
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
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-surface-500">
              <span>{t("prospects.score")}: {prospect.score}</span>
              <span>{t("prospects.da")}: {prospect.mozDa ?? t("common.na")}</span>
              <span>{t("prospects.tier")}: {prospect.tier ? `T${prospect.tier}` : t("common.na")}</span>
              {prospect.opportunityType && (
                <span className={`badge ${OPPORTUNITY_TYPE_COLORS[prospect.opportunityType] ?? "bg-surface-100 text-surface-700"}`}>
                  <Target size={12} className="mr-1 inline" />
                  {prospect.opportunityType.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {/* Thematic categories */}
            {prospect.thematicCategories &&
              Array.isArray(prospect.thematicCategories) &&
              (prospect.thematicCategories as string[]).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Tags size={14} className="text-surface-400" />
                  {(prospect.thematicCategories as string[]).map(
                    (theme: string, idx: number) => (
                      <span
                        key={theme}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${THEME_COLORS[idx % THEME_COLORS.length]}`}
                      >
                        {theme}
                      </span>
                    ),
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="btn-primary"
          >
            <Send size={16} className="mr-1.5" /> {t("prospectDetail.enroll")}
          </button>
          <button
            onClick={() => markWonMutation.mutate()}
            disabled={markWonMutation.isPending}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700"
          >
            <Trophy size={16} className="mr-1.5" /> {t("prospectDetail.markWon")}
          </button>
          <button
            onClick={() => recontactMutation.mutate()}
            disabled={recontactMutation.isPending}
            className="btn-secondary"
          >
            <RefreshCcw size={16} className="mr-1.5" /> {t("prospectDetail.recontact")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
            <Mail size={16} /> {t("prospectDetail.contactInfo")}
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-surface-500">{t("prospectDetail.email")}</dt>
              <dd>
                <InlineEdit
                  value={firstContact?.email ?? null}
                  placeholder={t("common.notSet")}
                  onSave={(val) => {
                    if (firstContact?.id && val !== null) {
                      api.put(`/contacts/${firstContact.id}`, { email: val })
                        .then(() => {
                          queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
                          toast.success(t("prospectDetail.emailUpdated"));
                        })
                        .catch((err) => {
                          toast.error(t("common.error"));
                          console.error(err);
                        });
                    }
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-surface-500">{t("prospectDetail.contactName")}</dt>
              <dd>
                <InlineEdit
                  value={firstContact?.name ?? null}
                  placeholder={t("common.notSet")}
                  onSave={(val) => {
                    if (firstContact?.id && val !== null) {
                      api.put(`/contacts/${firstContact.id}`, { name: val })
                        .then(() => {
                          queryClient.invalidateQueries({ queryKey: ["prospect", numericId] });
                          toast.success(t("prospectDetail.contactNameUpdated"));
                        })
                        .catch((err) => {
                          toast.error(t("common.error"));
                          console.error(err);
                        });
                    }
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-surface-500">{t("prospectDetail.contactFormUrl")}</dt>
              <dd>
                <InlineEdit
                  value={prospect.contactFormUrl}
                  placeholder={t("common.notSet")}
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
            <FileText size={16} /> {t("prospectDetail.enrichmentData")}
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium text-surface-500">{t("prospects.country")}</dt>
                <dd className="text-surface-900">
                  {prospect.country ?? t("common.na")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">{t("prospects.language")}</dt>
                <dd className="text-surface-900">
                  {prospect.language ?? t("common.na")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">{t("prospects.source")}</dt>
                <dd className="text-surface-900">{prospect.source}</dd>
              </div>
              <div>
                <dt className="font-medium text-surface-500">{t("prospectDetail.spamScore")}</dt>
                <dd className="text-surface-900">{prospect.spamScore}</dd>
              </div>
            </div>
            <div>
              <dt className="font-medium text-surface-500">
                {t("prospectDetail.neighborhoodScore")}
              </dt>
              <dd className="text-surface-900">
                {prospect.linkNeighborhoodScore !== null
                  ? `${prospect.linkNeighborhoodScore}/100`
                  : t("common.notAnalyzed")}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tags Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900">🏷️ Tags</h3>
          <button
            onClick={() => {
              setSelectedTagIds(prospect?.tags?.map(t => t.tagId) || []);
              setShowTagModal(true);
            }}
            className="btn-secondary text-sm"
          >
            <Pencil size={14} className="mr-1.5" />
            {t("common.edit")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {prospect?.tags && prospect.tags.length > 0 ? (
            prospect.tags.map((pt) => (
              <span
                key={pt.tagId}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: pt.tag.color }}
                title={pt.tag.description || pt.tag.label}
              >
                {pt.tag.label}
              </span>
            ))
          ) : (
            <p className="text-sm text-surface-500 italic">
              Aucun tag assigné
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
          <Clock size={16} /> {t("prospectDetail.timeline")}
        </h3>
        {!timeline?.length ? (
          <p className="text-sm text-surface-400">{t("prospectDetail.noEventsYet")}</p>
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

      {/* Sent Emails */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
          <Inbox size={16} /> Sent Emails
        </h3>
        {!sentEmails?.length ? (
          <p className="text-sm text-surface-400">No emails sent to this prospect yet.</p>
        ) : (
          <div className="space-y-2">
            {sentEmails.map((email) => {
              const isExpanded = expandedEmailId === email.id;
              return (
                <div
                  key={email.id}
                  className="rounded-lg border border-surface-200"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedEmailId(isExpanded ? null : email.id)
                    }
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-surface-50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="shrink-0 rounded bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600">
                        Step {email.stepNumber}
                      </span>
                      <span className="truncate text-sm font-medium text-surface-900">
                        {email.subject}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`badge text-xs ${EMAIL_STATUS_COLORS[email.status] ?? "bg-surface-100 text-surface-700"}`}
                      >
                        {email.status}
                      </span>
                      {email.openCount > 0 && (
                        <span className="text-xs text-emerald-600">
                          {email.openCount} open{email.openCount > 1 ? "s" : ""}
                        </span>
                      )}
                      <time className="text-xs text-surface-400">
                        {format(new Date(email.sentAt), "dd MMM yyyy HH:mm")}
                      </time>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-surface-400" />
                      ) : (
                        <ChevronDown size={14} className="text-surface-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-surface-200 bg-surface-50 p-4">
                      <div className="mb-2 flex items-center gap-3 text-xs text-surface-500">
                        <span>Language: {email.language}</span>
                        <span>Generated by: {email.generatedBy}</span>
                        {email.abVariant && (
                          <span className="badge bg-indigo-100 text-indigo-700">
                            Variant {email.abVariant}
                          </span>
                        )}
                      </div>
                      <div
                        className="prose prose-sm max-w-none text-surface-700"
                        dangerouslySetInnerHTML={{ __html: email.body }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CRM Notes */}
      <ProspectNotes prospectId={numericId} />

      {/* Backlinks */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
          <Link2 size={16} /> {t("prospectDetail.backlinks")}
        </h3>
        {!backlinks?.length ? (
          <p className="text-sm text-surface-400">{t("prospectDetail.noBacklinksRecorded")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-200">
                <tr>
                  <th className="pb-2 font-medium text-surface-500">{t("prospectDetail.target")}</th>
                  <th className="pb-2 font-medium text-surface-500">{t("prospectDetail.anchor")}</th>
                  <th className="pb-2 font-medium text-surface-500">{t("prospectDetail.type")}</th>
                  <th className="pb-2 font-medium text-surface-500">{t("prospectDetail.live")}</th>
                  <th className="pb-2 font-medium text-surface-500">
                    {t("prospectDetail.firstDetected")}
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
                          : t("common.na")}
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

      {/* Tag Editor Modal */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900">
                ✏️ Modifier les tags
              </h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-surface-400 hover:text-surface-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 mb-4">
              {allTags.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-8">
                  Aucun tag disponible. Créez d'abord des tags sur la page <a href="/tags" className="text-brand-600 hover:underline">/tags</a>
                </p>
              ) : (
                allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 p-3 hover:bg-surface-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTagIds([...selectedTagIds, tag.id]);
                        } else {
                          setSelectedTagIds(
                            selectedTagIds.filter((id) => id !== tag.id)
                          );
                        }
                      }}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.label}
                    </span>
                    {tag.description && (
                      <span className="text-sm text-surface-500 ml-auto">
                        {tag.description}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-surface-200">
              <p className="text-sm text-surface-600">
                {selectedTagIds.length} tag(s) sélectionné(s)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTagModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={() => updateTagsMutation.mutate(selectedTagIds)}
                  disabled={updateTagsMutation.isPending}
                  className="btn-primary"
                >
                  {updateTagsMutation.isPending
                    ? "💾 Sauvegarde..."
                    : "💾 Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
