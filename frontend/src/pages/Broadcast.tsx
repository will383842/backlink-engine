import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Pause,
  Trash2,
  Eye,
  Send,
  ChevronDown,
  ChevronUp,
  MousePointer,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import api from "@/lib/api";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BroadcastCampaign {
  id: number;
  name: string;
  campaignType: string;
  language: string;
  brief: string | null;
  sourceEmail: { subject: string; body: string } | null;
  targetSourceContactTypes: string[] | null;
  warmupSchedule: number[] | null;
  currentWarmupDay: number;
  totalEnrolled: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  isActive: boolean;
  createdAt: string;
  // Detail fields
  eligibleContacts?: number;
  dailyLimit?: number;
  sentToday?: number;
  remainingToday?: number;
}

interface BroadcastStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  totalEnrolled: number;
  eligibleRemaining: number;
  warmupSchedule: number[] | null;
  currentWarmupDay: number;
  byLanguage: { language: string; count: number }[];
  byType: { type: string; count: number }[];
  byStatus: Record<string, number>;
}

const CONTACT_TYPES = [
  { value: "presse", label: "Presse" },
  { value: "blog", label: "Blog" },
  { value: "influenceur", label: "Influenceur" },
  { value: "instagrammeur", label: "Instagrammeur" },
  { value: "youtubeur", label: "YouTubeur" },
  { value: "podcast_radio", label: "Podcast / Radio" },
  { value: "ufe", label: "UFE" },
  { value: "alliance_francaise", label: "Alliance Francaise" },
  { value: "association", label: "Association" },
  { value: "consulat", label: "Consulat" },
  { value: "chambre_commerce", label: "Chambre de Commerce" },
  { value: "ecole", label: "Ecole" },
  { value: "institut_culturel", label: "Institut Culturel" },
  { value: "avocat", label: "Avocat" },
  { value: "traducteur", label: "Traducteur" },
  { value: "assurance", label: "Assurance" },
  { value: "banque_fintech", label: "Banque / Fintech" },
  { value: "immobilier", label: "Immobilier" },
  { value: "agence_voyage", label: "Agence de Voyage" },
  { value: "communaute_expat", label: "Communaute Expat" },
  { value: "partenaire", label: "Partenaire" },
];

const WARMUP_PRESETS = {
  conservative: { label: "Conservateur (8 jours)", schedule: [5, 10, 20, 40, 75, 150, 300, 500] },
  moderate: { label: "Modere (6 jours)", schedule: [25, 50, 100, 250, 500, 1000] },
  aggressive: { label: "Agressif (4 jours)", schedule: [50, 100, 250, 500, 1000, 2000] },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Broadcast() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formBrief, setFormBrief] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formLanguage, setFormLanguage] = useState("fr");
  const [formTypes, setFormTypes] = useState<string[]>([]);
  const [formWarmup, setFormWarmup] = useState<string>("conservative");

  // Queries
  const { data: campaigns, isLoading } = useQuery<BroadcastCampaign[]>({
    queryKey: ["broadcast-campaigns"],
    queryFn: async () => {
      const res = await api.get("/broadcast");
      return res.data.data;
    },
    refetchInterval: 15_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const schedule = WARMUP_PRESETS[formWarmup as keyof typeof WARMUP_PRESETS]?.schedule ?? WARMUP_PRESETS.conservative.schedule;
      return api.post("/broadcast", {
        name: formName,
        language: formLanguage,
        brief: formBrief,
        sourceEmail: { subject: formSubject, body: formBody },
        targetSourceContactTypes: formTypes,
        warmupSchedule: schedule,
      });
    },
    onSuccess: () => {
      toast.success(t("broadcast.created"));
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      setShowForm(false);
      setFormName(""); setFormBrief(""); setFormSubject(""); setFormBody(""); setFormTypes([]);
    },
    onError: () => toast.error(t("broadcast.createError")),
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => api.post(`/broadcast/${id}/start`),
    onSuccess: () => {
      toast.success(t("broadcast.started"));
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) => api.post(`/broadcast/${id}/pause`),
    onSuccess: () => {
      toast.success(t("broadcast.paused"));
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/broadcast/${id}`),
    onSuccess: () => {
      toast.success(t("broadcast.deleted"));
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
    },
  });

  function toggleType(type: string) {
    setFormTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          {showForm ? t("common.cancel") : t("broadcast.newCampaign")}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <section className="rounded-xl border-2 border-brand-200 bg-brand-50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-surface-900">{t("broadcast.createTitle")}</h3>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.campaignName")}</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                placeholder="ex: Sondage Expat 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.defaultLanguage")}</label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
              >
                <option value="fr">Francais</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="es">Espanol</option>
                <option value="pt">Portugues</option>
                <option value="nl">Nederlands</option>
                <option value="it">Italiano</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.brief")}</label>
            <textarea
              value={formBrief}
              onChange={(e) => setFormBrief(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
              placeholder="Message cle, CTA, liens importants..."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.sourceSubject")}</label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                placeholder="Objet de l'email modele"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.warmup")}</label>
              <select
                value={formWarmup}
                onChange={(e) => setFormWarmup(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
              >
                {Object.entries(WARMUP_PRESETS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("broadcast.sourceBody")}</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm font-mono"
              placeholder="Corps de l'email modele (l'IA generera des variations uniques a partir de ce texte)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("broadcast.targetTypes")}</label>
            <div className="flex flex-wrap gap-2">
              {CONTACT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => toggleType(ct.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    formTypes.includes(ct.value)
                      ? "bg-brand-600 text-white"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!formName || !formSubject || !formBody || formTypes.length === 0 || createMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {createMutation.isPending ? t("common.creating") : t("broadcast.create")}
            </button>
          </div>
        </section>
      )}

      {/* Campaign List */}
      <section className="space-y-4">
        {(!campaigns || campaigns.length === 0) && (
          <div className="rounded-xl border bg-white p-8 text-center text-surface-400">
            {t("broadcast.noCampaigns")}
          </div>
        )}

        {campaigns?.map((campaign) => (
          <div key={campaign.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {/* Campaign header row */}
            <div className="flex items-center gap-4 p-4">
              <div className={`h-3 w-3 rounded-full ${campaign.isActive ? "bg-emerald-500 animate-pulse" : "bg-surface-300"}`} />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-surface-900 truncate">{campaign.name}</h4>
                <p className="text-xs text-surface-400">
                  {format(new Date(campaign.createdAt), "dd/MM/yyyy")}
                  {" | "}
                  {(campaign.targetSourceContactTypes ?? []).join(", ")}
                </p>
              </div>

              {/* Stats pills */}
              <div className="hidden lg:flex items-center gap-3">
                <StatPill icon={<Send size={14} />} value={campaign.totalSent} label={t("broadcast.sent")} color="blue" />
                <StatPill icon={<Eye size={14} />} value={campaign.totalOpened} label={t("broadcast.opened")} color="green" />
                <StatPill icon={<MousePointer size={14} />} value={campaign.totalClicked} label={t("broadcast.clicked")} color="purple" />
                <StatPill icon={<AlertCircle size={14} />} value={campaign.totalBounced} label={t("broadcast.bounced")} color="red" />
              </div>

              {/* Warmup badge */}
              <div className="text-xs text-surface-500 text-center">
                <Clock size={14} className="mx-auto mb-0.5" />
                J{campaign.currentWarmupDay + 1}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {campaign.isActive ? (
                  <button onClick={() => pauseMutation.mutate(campaign.id)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50" title={t("broadcast.pause")}>
                    <Pause size={16} />
                  </button>
                ) : (
                  <button onClick={() => startMutation.mutate(campaign.id)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title={t("broadcast.start")}>
                    <Play size={16} />
                  </button>
                )}
                <button
                  onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
                  className="rounded-lg p-2 text-surface-400 hover:bg-surface-50"
                >
                  {expandedId === campaign.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  onClick={() => { if (confirm(t("broadcast.confirmDelete"))) deleteMutation.mutate(campaign.id); }}
                  className="rounded-lg p-2 text-red-400 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === campaign.id && (
              <CampaignDetail campaignId={campaign.id} />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${colorMap[color]}`}>
      {icon}
      <span>{value}</span>
      <span className="opacity-60">{label}</span>
    </div>
  );
}

function CampaignDetail({ campaignId }: { campaignId: number }) {
  const { t } = useTranslation();

  const { data: stats } = useQuery<BroadcastStats>({
    queryKey: ["broadcast-stats", campaignId],
    queryFn: async () => {
      const res = await api.get(`/broadcast/${campaignId}/stats`);
      return res.data.data;
    },
    refetchInterval: 10_000,
  });

  if (!stats) {
    return (
      <div className="border-t p-4 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const openRate = stats.totalDelivered > 0 ? ((stats.totalOpened / stats.totalDelivered) * 100).toFixed(1) : "0";
  const clickRate = stats.totalOpened > 0 ? ((stats.totalClicked / stats.totalOpened) * 100).toFixed(1) : "0";
  const bounceRate = stats.totalSent > 0 ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(1) : "0";

  const schedule = (stats.warmupSchedule ?? [5, 10, 20, 40, 75, 150, 300, 500]);
  const currentDay = stats.currentWarmupDay;
  const dailyLimit = schedule[Math.min(currentDay, schedule.length - 1)] ?? 0;

  return (
    <div className="border-t bg-surface-50 p-4 space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <MiniStat label={t("broadcast.totalRecipients")} value={stats.totalEnrolled + stats.eligibleRemaining} />
        <MiniStat label={t("broadcast.sent")} value={stats.totalSent} />
        <MiniStat label={t("broadcast.delivered")} value={stats.totalDelivered} />
        <MiniStat label={t("broadcast.openRate")} value={`${openRate}%`} />
        <MiniStat label={t("broadcast.clickRate")} value={`${clickRate}%`} />
        <MiniStat label={t("broadcast.bounceRate")} value={`${bounceRate}%`} highlight={parseFloat(bounceRate) > 5} />
        <MiniStat label={t("broadcast.remaining")} value={stats.eligibleRemaining} />
      </div>

      {/* Warmup progress */}
      <div className="rounded-lg bg-white p-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-surface-600 flex items-center gap-1">
            <Zap size={14} className="text-amber-500" />
            Warmup — {t("broadcast.day")} {currentDay + 1}/{schedule.length}
          </span>
          <span className="font-semibold text-surface-700">{dailyLimit} {t("broadcast.emailsPerDay")}</span>
        </div>
        <div className="flex gap-1">
          {schedule.map((limit, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full ${i <= currentDay ? "bg-amber-400" : "bg-surface-200"}`}
              title={`Jour ${i + 1}: ${limit}/jour`}
            />
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        {stats.byLanguage.length > 0 && (
          <div className="rounded-lg bg-white p-3">
            <h5 className="text-sm font-semibold text-surface-700 mb-2">{t("broadcast.byLanguage")}</h5>
            <div className="space-y-1">
              {stats.byLanguage.map((l) => (
                <div key={l.language} className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">{l.language?.toUpperCase() || "?"}</span>
                  <span className="font-medium text-surface-800">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {stats.byType.length > 0 && (
          <div className="rounded-lg bg-white p-3">
            <h5 className="text-sm font-semibold text-surface-700 mb-2">{t("broadcast.byType")}</h5>
            <div className="space-y-1">
              {stats.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">{item.type || "other"}</span>
                  <span className="font-medium text-surface-800">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${highlight ? "bg-red-50 border border-red-200" : "bg-white border border-surface-100"}`}>
      <p className={`text-lg font-bold ${highlight ? "text-red-600" : "text-surface-900"}`}>{value}</p>
      <p className="text-[10px] text-surface-500 leading-tight">{label}</p>
    </div>
  );
}
