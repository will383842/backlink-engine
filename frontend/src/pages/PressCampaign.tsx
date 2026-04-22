/**
 * Press Campaign — admin page for the Vague 4.3 brand-entity press outreach.
 *
 * Shows aggregated stats, contact list with filters, and launch controls for
 * the press-outreach queue. Consumes /api/press/* endpoints served by the
 * pressRoutes Fastify plugin.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import {
  Mail,
  Send,
  MessageCircle,
  CheckCircle2,
  Newspaper,
  AlertTriangle,
  XCircle,
  SkipForward,
  Rocket,
  Eye,
  RefreshCw,
} from "lucide-react";

type Status =
  | "PENDING"
  | "SENT"
  | "FOLLOW_UP_1"
  | "FOLLOW_UP_2"
  | "RESPONDED"
  | "PUBLISHED"
  | "BOUNCED"
  | "UNSUBSCRIBED"
  | "SKIPPED";
type Lang = "fr" | "en" | "es" | "de" | "pt" | "ru" | "zh" | "hi" | "ar" | "et";
type Angle =
  | "launch"
  | "ymyl"
  | "expat"
  | "estonia"
  | "human_interest"
  | "tech_startup"
  | "innovation"
  | "diaspora";

interface PressContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  mediaName: string;
  mediaUrl?: string | null;
  mediaDr?: number | null;
  lang: Lang;
  angle: Angle;
  market?: string | null;
  sentAt?: string | null;
  followUp1At?: string | null;
  followUp2At?: string | null;
  respondedAt?: string | null;
  articleUrl?: string | null;
  publishedAt?: string | null;
  status: Status;
  campaignTag?: string | null;
  notes?: string | null;
  updatedAt: string;
}

interface PressStats {
  byStatus: Partial<Record<Status, number>>;
  byLang: Partial<Record<Lang, number>>;
  byAngle: Partial<Record<Angle, number>>;
  totalArticles: number;
}

interface ContactsResponse {
  contacts: PressContact[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_META: Record<Status, { label: string; color: string; icon: JSX.Element }> = {
  PENDING:       { label: "En attente",     color: "bg-slate-100 text-slate-700",       icon: <Mail size={14} /> },
  SENT:          { label: "Envoyé",         color: "bg-blue-100 text-blue-700",         icon: <Send size={14} /> },
  FOLLOW_UP_1:   { label: "Relance J+5",    color: "bg-indigo-100 text-indigo-700",     icon: <RefreshCw size={14} /> },
  FOLLOW_UP_2:   { label: "Relance J+10",   color: "bg-purple-100 text-purple-700",     icon: <RefreshCw size={14} /> },
  RESPONDED:     { label: "Réponse reçue",  color: "bg-amber-100 text-amber-700",       icon: <MessageCircle size={14} /> },
  PUBLISHED:     { label: "Article publié", color: "bg-emerald-100 text-emerald-700",   icon: <Newspaper size={14} /> },
  BOUNCED:       { label: "Rejeté",         color: "bg-red-100 text-red-700",           icon: <AlertTriangle size={14} /> },
  UNSUBSCRIBED:  { label: "Désabonné",      color: "bg-gray-100 text-gray-700",         icon: <XCircle size={14} /> },
  SKIPPED:       { label: "Ignoré",         color: "bg-neutral-100 text-neutral-700",   icon: <SkipForward size={14} /> },
};

const LANG_EMOJI: Record<Lang, string> = {
  fr: "🇫🇷", en: "🇬🇧", es: "🇪🇸", de: "🇩🇪", pt: "🇵🇹",
  ru: "🇷🇺", zh: "🇨🇳", hi: "🇮🇳", ar: "🇸🇦", et: "🇪🇪",
};

const ANGLE_LABELS: Record<Angle, string> = {
  launch: "Lancement",
  ymyl: "YMYL juridique",
  expat: "Expatriation",
  estonia: "Estonie/tech",
  human_interest: "Témoignage",
  tech_startup: "Tech startup",
  innovation: "Innovation",
  diaspora: "Diaspora",
};

export default function PressCampaign() {
  const queryClient = useQueryClient();
  const [filterLang, setFilterLang] = useState<Lang | "">("");
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [filterAngle, setFilterAngle] = useState<Angle | "">("");
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<PressContact | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchOptions, setLaunchOptions] = useState<{
    lang?: Lang;
    angle?: Angle;
    campaignTag: string;
  }>({ campaignTag: "2026-Q2-launch" });

  const { data: stats, isLoading: loadingStats } = useQuery<PressStats>({
    queryKey: ["press-stats"],
    queryFn: async () => (await api.get("/press/stats")).data,
    refetchInterval: 30_000,
  });

  const { data: contacts, isLoading: loadingContacts } = useQuery<ContactsResponse>({
    queryKey: ["press-contacts", filterLang, filterStatus, filterAngle, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterLang) params.set("lang", filterLang);
      if (filterStatus) params.set("status", filterStatus);
      if (filterAngle) params.set("angle", filterAngle);
      params.set("page", String(page));
      params.set("limit", "25");
      return (await api.get(`/press/contacts?${params}`)).data;
    },
  });

  const launchMutation = useMutation({
    mutationFn: async (opts: { dryRun: boolean; lang?: Lang; angle?: Angle; campaignTag?: string }) =>
      (await api.post("/press/outreach/start", opts)).data,
    onSuccess: (data, vars) => {
      if (vars.dryRun) {
        toast.success(`Dry-run : ${data.wouldEnqueue ?? data.enqueued} contacts cible`, { duration: 5000 });
      } else {
        toast.success(`Campagne lancée : ${data.enqueued} emails en queue !`, { duration: 6000 });
        queryClient.invalidateQueries({ queryKey: ["press-stats"] });
        queryClient.invalidateQueries({ queryKey: ["press-contacts"] });
        setShowLaunchModal(false);
      }
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? "Erreur lors du lancement");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post("/press/verify-inboxes")).data,
    onSuccess: (data) => {
      const ok = Object.values(data).filter(Boolean).length;
      const total = Object.keys(data).length;
      toast.success(`Inboxes OK : ${ok}/${total}`, { duration: 5000 });
    },
    onError: () => toast.error("Health check SMTP échoué"),
  });

  const updateContactMutation = useMutation({
    mutationFn: async (payload: { id: string; articleUrl?: string; status?: Status; notes?: string }) =>
      (await api.patch(`/press/contacts/${payload.id}`, payload)).data,
    onSuccess: () => {
      toast.success("Contact mis à jour");
      queryClient.invalidateQueries({ queryKey: ["press-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["press-stats"] });
    },
  });

  // ── Stats cards ───────────────────────────────────────────────────────────
  const statsCards: Array<{ status: Status; count: number }> = (
    Object.keys(STATUS_META) as Status[]
  ).map((s) => ({ status: s, count: stats?.byStatus?.[s] ?? 0 }));

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campagne presse</h1>
          <p className="text-sm text-slate-500">
            Vague 4.3 brand entity — 91 journalistes ciblés, 9 langues, 5 inboxes presse@
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {verifyMutation.isPending ? "Test..." : "Vérifier SMTP"}
          </button>
          <button
            onClick={() => launchMutation.mutate({ dryRun: true, lang: launchOptions.lang, angle: launchOptions.angle })}
            disabled={launchMutation.isPending}
            className="flex items-center gap-2 rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
          >
            <Eye size={16} /> Dry-run
          </button>
          <button
            onClick={() => setShowLaunchModal(true)}
            disabled={launchMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Rocket size={16} /> Lancer campagne
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statsCards.map(({ status, count }) => {
          const meta = STATUS_META[status];
          return (
            <div
              key={status}
              className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm`}
            >
              <div className={`flex items-center gap-2 rounded px-2 py-1 text-xs font-medium ${meta.color}`}>
                {meta.icon}
                <span>{meta.label}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{count}</div>
            </div>
          );
        })}
      </div>

      {/* By language */}
      {stats && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Répartition par langue</h3>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {(Object.keys(LANG_EMOJI) as Lang[]).map((l) => (
              <div key={l} className="rounded bg-slate-50 p-2 text-center">
                <div className="text-lg">{LANG_EMOJI[l]}</div>
                <div className="mt-1 text-xs text-slate-500">{l.toUpperCase()}</div>
                <div className="text-sm font-semibold text-slate-900">{stats.byLang?.[l] ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Articles publiés (sources Wikidata) : <b className="text-emerald-700">{stats.totalArticles}</b></span>
            <span>Objectif J+30 : 3-8 articles pour notabilité Wikidata</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600">Langue</label>
          <select
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={filterLang}
            onChange={(e) => { setFilterLang(e.target.value as Lang | ""); setPage(1); }}
          >
            <option value="">Toutes</option>
            {(Object.keys(LANG_EMOJI) as Lang[]).map((l) => (
              <option key={l} value={l}>{LANG_EMOJI[l]} {l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Statut</label>
          <select
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as Status | ""); setPage(1); }}
          >
            <option value="">Tous</option>
            {(Object.keys(STATUS_META) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Angle</label>
          <select
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={filterAngle}
            onChange={(e) => { setFilterAngle(e.target.value as Angle | ""); setPage(1); }}
          >
            <option value="">Tous</option>
            {(Object.keys(ANGLE_LABELS) as Angle[]).map((a) => (
              <option key={a} value={a}>{ANGLE_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setFilterLang(""); setFilterStatus(""); setFilterAngle(""); setPage(1); }}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Réinitialiser
        </button>
        <div className="ml-auto text-xs text-slate-500">
          {contacts && <>{contacts.total} contacts • page {contacts.page}</>}
        </div>
      </div>

      {/* Contacts table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loadingContacts ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="md" label="Chargement..." />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Média</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Email</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lang</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Angle</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">DR</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Statut</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Mise à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts?.contacts.map((c) => {
                const meta = STATUS_META[c.status];
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className="cursor-pointer hover:bg-blue-50/30"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-slate-900">
                      {c.mediaName}
                      {c.mediaUrl && (
                        <a
                          href={c.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 text-xs text-blue-600 hover:underline"
                        >
                          ↗
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.email}</td>
                    <td className="px-3 py-2 text-sm">{LANG_EMOJI[c.lang]}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{ANGLE_LABELS[c.angle]}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{c.mediaDr ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                );
              })}
              {contacts?.contacts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                    Aucun contact trouvé avec ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {contacts && contacts.total > 25 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
          >
            ← Précédent
          </button>
          <span className="px-2 py-1 text-sm text-slate-600">
            Page {page} / {Math.ceil(contacts.total / 25)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(contacts.total / 25)}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Contact detail drawer */}
      {selectedContact && (
        <ContactDetailDrawer
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={(payload) => updateContactMutation.mutate({ id: selectedContact.id, ...payload })}
        />
      )}

      {/* Launch modal */}
      {showLaunchModal && (
        <LaunchModal
          options={launchOptions}
          onOptionsChange={setLaunchOptions}
          onCancel={() => setShowLaunchModal(false)}
          onDryRun={() => launchMutation.mutate({ dryRun: true, ...launchOptions })}
          onConfirm={() => launchMutation.mutate({ dryRun: false, ...launchOptions })}
          pendingCount={stats?.byStatus?.PENDING ?? 0}
          loading={launchMutation.isPending}
        />
      )}

      {loadingStats && !stats && (
        <div className="flex justify-center py-6">
          <Spinner size="md" label="Chargement stats..." />
        </div>
      )}
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function ContactDetailDrawer({
  contact, onClose, onUpdate,
}: {
  contact: PressContact;
  onClose: () => void;
  onUpdate: (payload: { articleUrl?: string; status?: Status; notes?: string }) => void;
}) {
  const [articleUrl, setArticleUrl] = useState(contact.articleUrl ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{contact.mediaName}</h3>
            <p className="text-sm text-slate-500">{contact.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Langue</dt><dd>{LANG_EMOJI[contact.lang]} {contact.lang}</dd>
          <dt className="text-slate-500">Angle</dt><dd>{ANGLE_LABELS[contact.angle]}</dd>
          <dt className="text-slate-500">DR</dt><dd>{contact.mediaDr ?? "—"}</dd>
          <dt className="text-slate-500">Marché</dt><dd>{contact.market ?? "—"}</dd>
          <dt className="text-slate-500">Statut</dt><dd>{STATUS_META[contact.status].label}</dd>
          <dt className="text-slate-500">Campagne</dt><dd>{contact.campaignTag ?? "—"}</dd>
          <dt className="text-slate-500">Envoi J+0</dt><dd>{contact.sentAt ? new Date(contact.sentAt).toLocaleString("fr-FR") : "—"}</dd>
          <dt className="text-slate-500">Relance J+5</dt><dd>{contact.followUp1At ? new Date(contact.followUp1At).toLocaleString("fr-FR") : "—"}</dd>
          <dt className="text-slate-500">Relance J+10</dt><dd>{contact.followUp2At ? new Date(contact.followUp2At).toLocaleString("fr-FR") : "—"}</dd>
          <dt className="text-slate-500">Réponse</dt><dd>{contact.respondedAt ? new Date(contact.respondedAt).toLocaleString("fr-FR") : "—"}</dd>
        </dl>

        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">URL article publié</label>
            <input
              type="url"
              value={articleUrl}
              onChange={(e) => setArticleUrl(e.target.value)}
              placeholder="https://lemonde.fr/article/..."
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdate({ articleUrl: articleUrl || undefined, notes: notes || undefined })}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              Sauvegarder
            </button>
            {articleUrl && (
              <button
                onClick={() => onUpdate({ articleUrl, status: "PUBLISHED", notes: notes || undefined })}
                className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={14} /> Marquer publié
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Launch confirmation modal ────────────────────────────────────────────────
function LaunchModal({
  options, onOptionsChange, onCancel, onDryRun, onConfirm, pendingCount, loading,
}: {
  options: { lang?: Lang; angle?: Angle; campaignTag: string };
  onOptionsChange: (opts: { lang?: Lang; angle?: Angle; campaignTag: string }) => void;
  onCancel: () => void;
  onDryRun: () => void;
  onConfirm: () => void;
  pendingCount: number;
  loading: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Lancer la campagne presse</h3>
        <p className="mt-1 text-sm text-slate-500">
          Envoie un pitch personnalisé dans la bonne langue + PDF joint à chaque
          contact. Les follow-ups J+5 et J+10 sont programmés automatiquement.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Filtrer par langue (optionnel)</label>
            <select
              value={options.lang ?? ""}
              onChange={(e) => onOptionsChange({ ...options, lang: (e.target.value || undefined) as Lang | undefined })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Toutes les langues</option>
              {(Object.keys(LANG_EMOJI) as Lang[]).map((l) => (
                <option key={l} value={l}>{LANG_EMOJI[l]} {l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Filtrer par angle (optionnel)</label>
            <select
              value={options.angle ?? ""}
              onChange={(e) => onOptionsChange({ ...options, angle: (e.target.value || undefined) as Angle | undefined })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Tous les angles</option>
              {(Object.keys(ANGLE_LABELS) as Angle[]).map((a) => (
                <option key={a} value={a}>{ANGLE_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Tag campagne</label>
            <input
              type="text"
              value={options.campaignTag}
              onChange={(e) => onOptionsChange({ ...options, campaignTag: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          <b>⚠️ {pendingCount}</b> contacts en statut PENDING matchent actuellement (filtres appliqués sur la page seront pris en compte).
          <br />
          <label className="mt-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            Je confirme vouloir envoyer des emails réels à des journalistes.
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={onDryRun}
            disabled={loading}
            className="flex items-center gap-1 rounded border border-blue-600 bg-white px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
          >
            <Eye size={14} /> Dry-run
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !confirmed}
            className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Rocket size={14} /> {loading ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
