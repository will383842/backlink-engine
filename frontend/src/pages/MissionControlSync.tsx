import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  CalendarDays,
  CalendarRange,
  ArrowRight,
  Zap,
  Globe,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MCContact {
  id: number;
  domain: string;
  sourceContactType: string | null;
  category: string;
  language: string | null;
  country: string | null;
  status: string;
  score: number;
  createdAt: string;
  contacts: { email: string; firstName: string | null; lastName: string | null }[];
}

interface MCSyncData {
  webhook: {
    healthy: boolean;
    lastEventAt: string | null;
  };
  counts: {
    total: number;
    today: number;
    thisWeek: number;
  };
  typeDistribution: { type: string; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  enrichmentStatus: Record<string, number>;
  recentContacts: MCContact[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700",
  ENRICHING: "bg-amber-100 text-amber-700",
  READY_TO_CONTACT: "bg-blue-100 text-blue-700",
  CONTACTED_EMAIL: "bg-indigo-100 text-indigo-700",
  CONTACTED_MANUAL: "bg-indigo-100 text-indigo-700",
  REPLIED: "bg-purple-100 text-purple-700",
  NEGOTIATING: "bg-orange-100 text-orange-700",
  WON: "bg-emerald-100 text-emerald-700",
  LINK_VERIFIED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  DO_NOT_CONTACT: "bg-red-100 text-red-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  blogger: "bg-blue-100 text-blue-700",
  media: "bg-purple-100 text-purple-700",
  influencer: "bg-pink-100 text-pink-700",
  association: "bg-teal-100 text-teal-700",
  partner: "bg-amber-100 text-amber-700",
  corporate: "bg-indigo-100 text-indigo-700",
  other: "bg-gray-100 text-gray-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700"}`}>
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MissionControlSync() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<MCSyncData>({
    queryKey: ["mc-sync"],
    queryFn: async () => {
      const res = await api.get("/dashboard/mission-control-sync");
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center text-red-600">
        {t("mcSync.failedToLoad")}
      </div>
    );
  }

  const totalEnrichment = Object.values(data.enrichmentStatus).reduce((s, n) => s + n, 0);
  const enrichedCount = (data.enrichmentStatus["READY_TO_CONTACT"] ?? 0)
    + (data.enrichmentStatus["CONTACTED_EMAIL"] ?? 0)
    + (data.enrichmentStatus["CONTACTED_MANUAL"] ?? 0)
    + (data.enrichmentStatus["REPLIED"] ?? 0)
    + (data.enrichmentStatus["NEGOTIATING"] ?? 0)
    + (data.enrichmentStatus["WON"] ?? 0)
    + (data.enrichmentStatus["LINK_PENDING"] ?? 0)
    + (data.enrichmentStatus["LINK_VERIFIED"] ?? 0);
  const pendingCount = (data.enrichmentStatus["NEW"] ?? 0) + (data.enrichmentStatus["ENRICHING"] ?? 0);
  const enrichedPct = totalEnrichment > 0 ? Math.round((enrichedCount / totalEnrichment) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Webhook Health */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity size={20} className="text-brand-500" />
          <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.webhookStatus")}</h3>
        </div>
        <div className={`rounded-xl border-2 p-5 ${data.webhook.healthy ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-3">
            {data.webhook.healthy ? (
              <CheckCircle2 size={28} className="text-emerald-600" />
            ) : (
              <XCircle size={28} className="text-red-600" />
            )}
            <div>
              <p className={`text-lg font-semibold ${data.webhook.healthy ? "text-emerald-800" : "text-red-800"}`}>
                {data.webhook.healthy ? t("mcSync.webhookHealthy") : t("mcSync.webhookDown")}
              </p>
              <p className="text-sm text-surface-500">
                {data.webhook.lastEventAt ? (
                  <>
                    {t("mcSync.lastEvent")}: {format(new Date(data.webhook.lastEventAt), "dd/MM/yyyy HH:mm")}
                    {" "}({formatDistanceToNow(new Date(data.webhook.lastEventAt), { addSuffix: true })})
                  </>
                ) : (
                  t("mcSync.noEventsReceived")
                )}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-surface-600 font-mono">
            POST /api/webhooks/mission-control/contact-created
          </div>
        </div>
      </section>

      {/* Counters */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users size={20} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.contactsReceived")}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-600">
              <CalendarDays size={16} />
              {t("mcSync.today")}
            </div>
            <p className="mt-1 text-3xl font-bold text-brand-800">{data.counts.today}</p>
          </div>
          <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <CalendarRange size={16} />
              {t("mcSync.thisWeek")}
            </div>
            <p className="mt-1 text-3xl font-bold text-indigo-800">{data.counts.thisWeek}</p>
          </div>
          <div className="rounded-xl border-2 border-surface-200 bg-surface-50 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-600">
              <Globe size={16} />
              {t("mcSync.totalSynced")}
            </div>
            <p className="mt-1 text-3xl font-bold text-surface-800">{data.counts.total}</p>
          </div>
        </div>
      </section>

      {/* Type & Category Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By MC type */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Zap size={20} className="text-amber-500" />
            <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.bySourceType")}</h3>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {data.typeDistribution.length === 0 ? (
              <p className="text-sm text-surface-400">{t("mcSync.noData")}</p>
            ) : (
              <div className="space-y-2">
                {data.typeDistribution.map((item) => {
                  const pct = data.counts.total > 0 ? Math.round((item.count / data.counts.total) * 100) : 0;
                  return (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="w-32 truncate text-sm font-medium text-surface-700">{item.type}</span>
                      <div className="flex-1">
                        <div className="h-5 rounded-full bg-surface-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold text-surface-600">
                        {item.count} <span className="text-xs text-surface-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* By BL category */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Users size={20} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.byCategory")}</h3>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {data.categoryDistribution.length === 0 ? (
              <p className="text-sm text-surface-400">{t("mcSync.noData")}</p>
            ) : (
              <div className="space-y-2">
                {data.categoryDistribution.map((item) => {
                  const pct = data.counts.total > 0 ? Math.round((item.count / data.counts.total) * 100) : 0;
                  return (
                    <div key={item.category} className="flex items-center gap-3">
                      <CategoryBadge category={item.category} />
                      <div className="flex-1">
                        <div className="h-5 rounded-full bg-surface-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-400 transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold text-surface-600">
                        {item.count} <span className="text-xs text-surface-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Enrichment Status */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock size={20} className="text-emerald-500" />
          <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.enrichmentStatus")}</h3>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-surface-600">{t("mcSync.enriched")}: {enrichedCount}/{totalEnrichment}</span>
              <span className="font-semibold text-emerald-600">{enrichedPct}%</span>
            </div>
            <div className="h-4 rounded-full bg-surface-100 overflow-hidden">
              {enrichedPct > 0 && (
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${enrichedPct}%` }} />
              )}
            </div>
          </div>
          {/* Status breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.enrichmentStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div
                  key={status}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-opacity hover:opacity-80 ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}
                  onClick={() => navigate(`/prospects?status=${status}`)}
                >
                  <span className="font-semibold">{count}</span>
                  <span className="text-xs">{status.replace(/_/g, " ")}</span>
                </div>
              ))}
          </div>
          {pendingCount > 0 && (
            <p className="mt-3 text-xs text-amber-600">
              {pendingCount} {t("mcSync.pendingEnrichment")}
            </p>
          )}
        </div>
      </section>

      {/* Recent Contacts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight size={20} className="text-brand-500" />
            <h3 className="text-lg font-semibold text-surface-900">{t("mcSync.recentContacts")}</h3>
          </div>
          <span className="text-sm text-surface-400">{t("mcSync.last20")}</span>
        </div>
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-50 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t("mcSync.colDomain")}</th>
                <th className="px-4 py-3">{t("mcSync.colContact")}</th>
                <th className="px-4 py-3">{t("mcSync.colType")}</th>
                <th className="px-4 py-3">{t("mcSync.colCategory")}</th>
                <th className="px-4 py-3">{t("mcSync.colStatus")}</th>
                <th className="px-4 py-3">{t("mcSync.colScore")}</th>
                <th className="px-4 py-3">{t("mcSync.colDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.recentContacts.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-surface-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/prospects/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-brand-600">{c.domain}</td>
                  <td className="px-4 py-3 text-surface-600">
                    {c.contacts[0]
                      ? (
                        <>
                          {[c.contacts[0].firstName, c.contacts[0].lastName].filter(Boolean).join(" ") || ""}
                          <span className="block text-xs text-surface-400">{c.contacts[0].email}</span>
                        </>
                      )
                      : <span className="text-surface-300">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-600">{c.sourceContactType ?? "-"}</span>
                  </td>
                  <td className="px-4 py-3"><CategoryBadge category={c.category} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-surface-600">{c.score}</td>
                  <td className="px-4 py-3 text-xs text-surface-500">
                    {format(new Date(c.createdAt), "dd/MM HH:mm")}
                  </td>
                </tr>
              ))}
              {data.recentContacts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                    {t("mcSync.noContacts")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
