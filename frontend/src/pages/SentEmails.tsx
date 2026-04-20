import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Check,
  Ban,
  Pencil,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSentEmails, useSentEmailStats, useCampaigns } from "@/hooks/useApi";
import type { SentEmail, SentEmailFilters } from "@/types";
import { useTranslation } from "@/i18n";
import api from "@/lib/api";

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  approved: "bg-indigo-100 text-indigo-700",
  rejected: "bg-gray-200 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  delivered: "bg-cyan-100 text-cyan-700",
  opened: "bg-emerald-100 text-emerald-700",
  clicked: "bg-purple-100 text-purple-700",
  bounced: "bg-red-100 text-red-700",
  complained: "bg-orange-100 text-orange-700",
  failed: "bg-red-200 text-red-800",
};

const STATUS_OPTIONS = ["draft", "sent", "delivered", "opened", "clicked", "bounced", "complained", "rejected", "failed"];

// ---------------------------------------------------------------------------
// Stats card component
// ---------------------------------------------------------------------------

function StatsCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-brand-50 text-brand-700 border-brand-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium opacity-80">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email detail modal
// ---------------------------------------------------------------------------

function EmailDetailModal({
  email,
  onClose,
}: {
  email: SentEmail;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(email.subject);
  const [editBody, setEditBody] = useState(email.body);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/sent-emails/${email.id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Email approuvé et envoyé");
      queryClient.invalidateQueries({ queryKey: ["sentEmails"] });
      onClose();
    },
    onError: () => toast.error("Erreur lors de l'approbation"),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/sent-emails/${email.id}/reject`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Email rejeté");
      queryClient.invalidateQueries({ queryKey: ["sentEmails"] });
      onClose();
    },
    onError: () => toast.error("Erreur lors du rejet"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/sent-emails/${email.id}`, { subject: editSubject, body: editBody });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Brouillon modifié");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["sentEmails"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const isDraft = email.status === "draft";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white px-6 py-4 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-surface-900 truncate">
              {email.subject}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-surface-500">
              <span>{email.contact?.email ?? t("common.na")}</span>
              {email.contact?.firstName && (
                <span className="text-surface-400">
                  ({email.contact.firstName} {email.contact.lastName ?? ""})
                </span>
              )}
              <span className="text-surface-300">|</span>
              <span>{format(new Date(email.sentAt), "dd MMM yyyy HH:mm")}</span>
              <span
                className={`badge ${STATUS_COLORS[email.status] ?? "bg-surface-100 text-surface-600"}`}
              >
                {email.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Meta info */}
        <div className="border-b border-surface-100 px-6 py-3">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-surface-400">
                {t("sentEmails.campaign")}
              </span>
              <p className="mt-0.5 text-surface-700">{email.campaign?.name ?? t("common.na")}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-surface-400">
                {t("sentEmails.step")}
              </span>
              <p className="mt-0.5 text-surface-700">#{email.stepNumber}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-surface-400">
                {t("sentEmails.opens")}
              </span>
              <p className="mt-0.5 text-surface-700">{email.openCount}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-surface-400">
                {t("sentEmails.clicks")}
              </span>
              <p className="mt-0.5 text-surface-700">{email.clickCount}</p>
            </div>
          </div>
          {email.abVariant && (
            <div className="mt-2">
              <span className="badge bg-indigo-100 text-indigo-700">
                A/B: {email.abVariant}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
            {t("sentEmails.emailBody")}
          </h5>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-surface-500">Sujet</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500">Corps</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="btn-primary flex items-center gap-1.5 text-sm"
                >
                  <Check size={14} /> Sauvegarder
                </button>
                <button onClick={() => setEditing(false)} className="btn-secondary text-sm">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none rounded-lg bg-surface-50 p-4 text-surface-700"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          )}
        </div>

        {/* Draft action buttons */}
        {isDraft && !editing && (
          <div className="sticky bottom-0 flex items-center justify-between border-t border-surface-200 bg-yellow-50 px-6 py-4 rounded-b-2xl">
            <span className="text-sm font-medium text-yellow-800">
              Brouillon en attente de review
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
              >
                <Pencil size={14} /> Modifier
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
              >
                <Ban size={14} /> Rejeter
              </button>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <Check size={14} /> Approuver & Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SentEmails() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [filters, setFilters] = useState({
    campaignId: "",
    status: "",
    stepNumber: "",
    language: "",
    sourceContactType: "",
    fromDomain: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  const updateFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setSelectedDraftIds(new Set());
  }, []);

  // Build query filters
  const queryFilters: SentEmailFilters = { page, limit: 50 };
  if (filters.campaignId) queryFilters.campaignId = Number(filters.campaignId);
  if (filters.status) queryFilters.status = filters.status;
  if (filters.stepNumber) queryFilters.stepNumber = Number(filters.stepNumber);
  if (filters.language) queryFilters.language = filters.language;
  if (filters.sourceContactType) queryFilters.sourceContactType = filters.sourceContactType;
  if (filters.fromDomain) queryFilters.fromDomain = filters.fromDomain;
  if (filters.search) queryFilters.search = filters.search;
  if (filters.dateFrom) queryFilters.dateFrom = filters.dateFrom;
  if (filters.dateTo) queryFilters.dateTo = filters.dateTo;

  const { data: emailsData, isLoading } = useSentEmails(queryFilters);
  const { data: stats } = useSentEmailStats();
  const { data: campaigns } = useCampaigns();

  const isDraftView = filters.status === "draft";
  const visibleDrafts = (emailsData?.data ?? []).filter((e) => e.status === "draft");
  const allDraftsSelected =
    visibleDrafts.length > 0 && visibleDrafts.every((e) => selectedDraftIds.has(e.id));

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await api.post("/sent-emails/approve-all", { ids });
      return res.data;
    },
    onSuccess: (res) => {
      const { approved, failed, errors } = res.data ?? {};
      if (failed > 0) {
        toast.error(`${approved} envoyés, ${failed} échecs`);
        if (errors?.length) console.warn("bulk approve errors", errors);
      } else {
        toast.success(`${approved} email(s) envoyé(s) avec succès`);
      }
      setSelectedDraftIds(new Set());
      setConfirmingBulk(false);
      queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
      queryClient.invalidateQueries({ queryKey: ["sent-emails-stats"] });
    },
    onError: () => toast.error("Erreur bulk approve"),
  });

  function toggleDraft(id: number) {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllDrafts() {
    if (allDraftsSelected) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(visibleDrafts.map((e) => e.id)));
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatsCard
            label={t("sentEmails.totalSent")}
            value={stats.totalSent}
            sub={`${stats.totalDelivered} ${t("sentEmails.delivered")}`}
            color="blue"
            icon={<Send size={16} />}
          />
          <StatsCard
            label={t("sentEmails.openRate")}
            value={`${stats.openRate}%`}
            sub={`${stats.totalOpened} ${t("sentEmails.opened")}`}
            color="green"
            icon={<Eye size={16} />}
          />
          <StatsCard
            label={t("sentEmails.clickRate")}
            value={`${stats.clickRate}%`}
            sub={`${stats.totalClicked} ${t("sentEmails.clicked")}`}
            color="purple"
            icon={<MousePointerClick size={16} />}
          />
          <StatsCard
            label={t("sentEmails.bounceRate")}
            value={`${stats.bounceRate}%`}
            sub={`${stats.totalBounced} ${t("sentEmails.bounced")}`}
            color="red"
            icon={<AlertTriangle size={16} />}
          />
          <StatsCard
            label={t("sentEmails.complained")}
            value={stats.totalComplained}
            sub={`${stats.totalFailed} ${t("sentEmails.failed")}`}
            color="amber"
            icon={<Mail size={16} />}
          />
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-3">
        {/* Search bar (full width) */}
        <input
          type="text"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="input-field w-full"
          placeholder="Recherche (sujet, email destinataire, domaine du prospect)…"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filters.campaignId}
            onChange={(e) => updateFilter("campaignId", e.target.value)}
            className="input-field"
          >
            <option value="">{t("sentEmails.allCampaigns")}</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="input-field"
          >
            <option value="">{t("sentEmails.allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filters.language}
            onChange={(e) => updateFilter("language", e.target.value)}
            className="input-field"
          >
            <option value="">Toutes les langues</option>
            {["fr", "en", "es", "de", "pt", "ru", "ar", "zh", "hi"].map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>

          <select
            value={filters.sourceContactType}
            onChange={(e) => updateFilter("sourceContactType", e.target.value)}
            className="input-field"
          >
            <option value="">Tous les types de contact</option>
            <option value="blog">Blog</option>
            <option value="blogger">Blogger</option>
            <option value="influencer">Influencer</option>
            <option value="youtubeur">YouTubeur</option>
            <option value="instagrammeur">Instagrammeur</option>
            <option value="media">Média</option>
            <option value="presse">Presse</option>
            <option value="partner">Partenaire</option>
            <option value="agency">Agence</option>
            <option value="association">Association</option>
            <option value="corporate">Corporate</option>
            <option value="podcast_radio">Podcast / Radio</option>
            <option value="annuaire">Annuaire</option>
          </select>

          <select
            value={filters.fromDomain}
            onChange={(e) => updateFilter("fromDomain", e.target.value)}
            className="input-field"
          >
            <option value="">Tous les domaines d'envoi</option>
            <option value="plane-liberty.com">plane-liberty.com</option>
            <option value="providers-expat.com">providers-expat.com</option>
            <option value="emilia-mullerd.com">emilia-mullerd.com</option>
            <option value="planevilain.com">planevilain.com</option>
            <option value="hub-travelers.com">hub-travelers.com</option>
            <option value="life-expat.com">life-expat.com</option>
          </select>

          <select
            value={filters.stepNumber}
            onChange={(e) => updateFilter("stepNumber", e.target.value)}
            className="input-field"
          >
            <option value="">{t("sentEmails.allSteps")}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t("sentEmails.step")} {n}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="input-field"
            placeholder={t("sentEmails.from")}
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="input-field"
            placeholder={t("sentEmails.to")}
          />
        </div>
      </div>

      {/* Bulk-approve action bar — only visible in draft view, only when
          at least one draft is selected. Mirrors the Gmail/Linear pattern
          of "select rows then act on them". 100-row server-side cap is
          enforced by the backend, plus a confirmation modal triggers above
          10 to prevent fat-finger mistakes. */}
      {isDraftView && selectedDraftIds.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-emerald-900">
            {selectedDraftIds.size} brouillon{selectedDraftIds.size > 1 ? "s" : ""} sélectionné{selectedDraftIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDraftIds(new Set())}
              className="text-xs text-surface-600 hover:underline"
            >
              Désélectionner
            </button>
            <button
              onClick={() => {
                if (selectedDraftIds.size > 10) setConfirmingBulk(true);
                else bulkApproveMutation.mutate(Array.from(selectedDraftIds));
              }}
              disabled={bulkApproveMutation.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkApproveMutation.isPending ? "Envoi…" : `✓ Approuver et envoyer (${selectedDraftIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation modal — shown above 10 drafts to slow the user down */}
      {confirmingBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-surface-900">
              Confirmer l'envoi de {selectedDraftIds.size} emails ?
            </h3>
            <p className="text-sm text-surface-600">
              Tous ces brouillons partiront immédiatement via SMTP direct
              (Postfix/PMTA). Cette action est irréversible une fois les
              emails envoyés.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingBulk(false)}
                className="rounded-lg border border-surface-300 bg-white px-4 py-2 text-sm hover:bg-surface-50"
              >
                Annuler
              </button>
              <button
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedDraftIds))}
                disabled={bulkApproveMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {bulkApproveMutation.isPending ? "Envoi…" : "Oui, envoyer tout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                {isDraftView && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allDraftsSelected}
                      onChange={toggleAllDrafts}
                      title="Tout sélectionner"
                      className="h-4 w-4"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.date")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.recipient")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.subject")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.step")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.statusCol")}</th>
                <th className="px-4 py-3 font-medium text-surface-600 text-center">{t("sentEmails.opens")}</th>
                <th className="px-4 py-3 font-medium text-surface-600 text-center">{t("sentEmails.clicks")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("sentEmails.abVariant")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isDraftView ? 9 : 8} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !emailsData?.data.length ? (
                <tr>
                  <td colSpan={isDraftView ? 9 : 8} className="px-4 py-12 text-center text-surface-500">
                    {t("sentEmails.noEmailsFound")}
                  </td>
                </tr>
              ) : (
                emailsData.data.map((email) => (
                  <tr
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className="cursor-pointer transition-colors hover:bg-surface-50"
                  >
                    {isDraftView && (
                      <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                        {email.status === "draft" && (
                          <input
                            type="checkbox"
                            checked={selectedDraftIds.has(email.id)}
                            onChange={() => toggleDraft(email.id)}
                            className="h-4 w-4"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                      {format(new Date(email.sentAt), "dd MMM yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-surface-900 truncate max-w-[200px]">
                        {email.contact?.email ?? t("common.na")}
                      </div>
                      <div className="text-xs text-surface-400">
                        {email.prospect?.domain ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-700 truncate max-w-[250px]">
                      {email.subject}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-100 text-xs font-semibold text-surface-600">
                        {email.stepNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${STATUS_COLORS[email.status] ?? "bg-surface-100 text-surface-600"}`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-surface-600">
                      {email.openCount > 0 ? (
                        <span className="font-medium text-emerald-600">{email.openCount}</span>
                      ) : (
                        <span className="text-surface-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-surface-600">
                      {email.clickCount > 0 ? (
                        <span className="font-medium text-purple-600">{email.clickCount}</span>
                      ) : (
                        <span className="text-surface-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {email.abVariant ? (
                        <span className="badge bg-indigo-100 text-indigo-700">
                          {email.abVariant}
                        </span>
                      ) : (
                        <span className="text-surface-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {emailsData && emailsData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3">
            <p className="text-sm text-surface-500">
              {t("common.page")} {emailsData.page} {t("common.of")} {emailsData.totalPages} ({emailsData.total} {t("common.total")})
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(emailsData.totalPages, p + 1))}
                disabled={page >= emailsData.totalPages}
                className="btn-secondary"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email detail modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}
    </div>
  );
}
