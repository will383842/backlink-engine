import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  BarChart3,
  Mail,
  Eye,
  MousePointer,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import type { DashboardData } from "@/types";
import { useTranslation } from "@/i18n";

function StatsCard({
  label,
  value,
  color,
  to,
}: {
  label: string;
  value: number;
  color: string;
  to?: string;
}) {
  const navigate = useNavigate();
  const colorMap: Record<string, string> = {
    red: "bg-red-50 text-red-700 border-red-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-brand-50 text-brand-700 border-brand-200",
  };

  const baseClasses = `rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`;
  const clickableClasses = to
    ? "cursor-pointer transition-shadow hover:shadow-md"
    : "";

  return (
    <div
      className={`${baseClasses} ${clickableClasses}`}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? "link" : undefined}
    >
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get("/dashboard/today");
      return res.data as DashboardData;
    },
  });

  // Outreach overview (contactable / no method / enriching)
  const { data: outreachOverview } = useQuery({
    queryKey: ["outreachOverview"],
    queryFn: async () => {
      const res = await api.get("/dashboard/outreach-overview");
      return res.data?.data as {
        contactable: { total: number; emailOnly: number; formOnly: number; both: number };
        noContactMethod: number;
        enriching: { total: number; newCount: number };
        outreach: { contacted: number; replied: number; won: number };
      } | undefined;
    },
    staleTime: 60_000,
  });

  // Email performance stats (from SentEmail table)
  const { data: emailStats } = useQuery({
    queryKey: ["sentEmailStats"],
    queryFn: async () => {
      const res = await api.get("/sent-emails/stats");
      return res.data?.data as {
        totalSent: number;
        totalOpened: number;
        totalClicked: number;
        totalBounced: number;
        totalDrafts: number;
        openRate: string;
        clickRate: string;
        bounceRate: string;
      } | undefined;
    },
    staleTime: 120_000,
  });

  // Pipeline counts
  const { data: pipeline } = useQuery({
    queryKey: ["dashboardPipeline"],
    queryFn: async () => {
      const res = await api.get("/dashboard/pipeline");
      return res.data?.data?.byStatus as Record<string, number> | undefined;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const urgent = data?.urgent ?? { repliesToHandle: 0, bounces: 0, lostBacklinks: 0 };
  const opportunities = data?.opportunities ?? { lostRecontactable: 0 };
  const stats = data?.stats ?? { sentToMailwizz: 0, repliesReceived: 0, backlinksWon: 0, prospectsAddedBySource: {} };

  if (error || !data) {
    return (
      <div className="card text-center text-red-600">
        {t("dashboard.failedToLoad")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Urgent */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={20} className="text-red-500" />
          <h3 className="text-lg font-semibold text-surface-900">{t("dashboard.urgent")}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCard
            label={t("dashboard.repliesToHandle")}
            value={urgent.repliesToHandle}
            color="red"
            to="/replies"
          />
          <StatsCard
            label={t("dashboard.bounces")}
            value={urgent.bounces}
            color="red"
            to="/replies?category=BOUNCE"
          />
          <StatsCard
            label={t("dashboard.lostBacklinks")}
            value={urgent.lostBacklinks}
            color="red"
            to="/backlinks?isLive=false"
          />
        </div>
      </section>

      {/* Outreach Overview — Vue principale */}
      {outreachOverview && (() => {
        const total = outreachOverview.contactable.total + outreachOverview.noContactMethod + outreachOverview.enriching.total;
        const contactablePct = total > 0 ? Math.round((outreachOverview.contactable.total / total) * 100) : 0;
        const noMethodPct = total > 0 ? Math.round((outreachOverview.noContactMethod / total) * 100) : 0;
        const enrichingPct = total > 0 ? Math.round((outreachOverview.enriching.total / total) * 100) : 0;

        return (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={20} className="text-brand-500" />
              <h3 className="text-lg font-semibold text-surface-900">Vue Outreach</h3>
            </div>
            <span className="text-sm text-surface-400">{total} prospects au total</span>
          </div>

          {/* Progress bar */}
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-100">
            {contactablePct > 0 && (
              <div className="bg-emerald-500 transition-all" style={{ width: `${contactablePct}%` }} title={`Contactables: ${contactablePct}%`} />
            )}
            {noMethodPct > 0 && (
              <div className="bg-surface-300 transition-all" style={{ width: `${noMethodPct}%` }} title={`Sans coordonnees: ${noMethodPct}%`} />
            )}
            {enrichingPct > 0 && (
              <div className="bg-amber-400 transition-all" style={{ width: `${enrichingPct}%` }} title={`En enrichissement: ${enrichingPct}%`} />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Contactable */}
            <div
              className="cursor-pointer rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 transition-shadow hover:shadow-md"
              onClick={() => navigate("/prospects?status=READY_TO_CONTACT")}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-emerald-700">Contactables</p>
                <span className="text-xs font-bold text-emerald-500">{contactablePct}%</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-emerald-800">{outreachOverview.contactable.total}</p>
              <div className="mt-3 space-y-1.5 text-xs text-emerald-600">
                <div className="flex items-center justify-between">
                  <span>Par email</span>
                  <span className="font-semibold">{outreachOverview.contactable.emailOnly + outreachOverview.contactable.both}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Par formulaire</span>
                  <span className="font-semibold">{outreachOverview.contactable.formOnly + outreachOverview.contactable.both}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Dont les deux</span>
                  <span>{outreachOverview.contactable.both}</span>
                </div>
              </div>
            </div>

            {/* No contact method */}
            <div className="rounded-xl border-2 border-surface-200 bg-surface-50 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-surface-500">Sans coordonnees</p>
                <span className="text-xs font-bold text-surface-400">{noMethodPct}%</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-surface-400">{outreachOverview.noContactMethod}</p>
              <p className="mt-3 text-xs text-surface-400">
                Enrichis mais aucun email ni formulaire de contact trouve sur leur site
              </p>
            </div>

            {/* Enriching */}
            <div
              className="cursor-pointer rounded-xl border-2 border-amber-200 bg-amber-50 p-5 transition-shadow hover:shadow-md"
              onClick={() => navigate("/prospects?status=NEW")}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-700">En enrichissement</p>
                <span className="text-xs font-bold text-amber-500">{enrichingPct}%</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-amber-800">{outreachOverview.enriching.total}</p>
              <p className="mt-3 text-xs text-amber-600">
                Scraping + verification email + classification IA en cours (auto 24h/24)
              </p>
            </div>
          </div>

          {/* Outreach funnel */}
          <div className="mt-4 flex gap-3 flex-wrap">
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2.5 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-indigo-600 font-semibold">{outreachOverview.outreach.contacted}</span>
              <span className="text-indigo-500">contactes</span>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-2.5 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-purple-600 font-semibold">{outreachOverview.outreach.replied}</span>
              <span className="text-purple-500">reponses</span>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-emerald-700 font-semibold">{outreachOverview.outreach.won}</span>
              <span className="text-emerald-600">gagnes</span>
            </div>
          </div>
        </section>
        );
      })()}

      {/* Actions rapides */}
      {outreachOverview && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={20} className="text-amber-500" />
            <h3 className="text-lg font-semibold text-surface-900">Actions</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard
              label="Formulaires a traiter"
              value={outreachOverview.contactable.formOnly + outreachOverview.contactable.both}
              color="yellow"
              to="/form-outreach"
            />
            <StatsCard
              label="Emails drafts a valider"
              value={emailStats?.totalDrafts ?? 0}
              color="yellow"
              to="/sent-emails?status=draft"
            />
            <StatsCard
              label="Prospects recontactables"
              value={opportunities.lostRecontactable}
              color="green"
              to="/recontact"
            />
          </div>
        </section>
      )}

      {/* Email Performance */}
      {emailStats && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Mail size={20} className="text-indigo-500" />
            <h3 className="text-lg font-semibold text-surface-900">
              {t("dashboard.emailPerformance")}
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Mail size={16} />
                <span>{t("sentEmails.totalSent")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-surface-900">{emailStats.totalSent}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Eye size={16} />
                <span>{t("sentEmails.openRate")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{emailStats.openRate}</p>
              <p className="text-xs text-surface-400">
                {emailStats.totalOpened} {t("sentEmails.opened")}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <MousePointer size={16} />
                <span>{t("sentEmails.clickRate")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-blue-600">{emailStats.clickRate}</p>
              <p className="text-xs text-surface-400">
                {emailStats.totalClicked} {t("sentEmails.clicked")}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <AlertCircle size={16} />
                <span>{t("sentEmails.bounceRate")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-red-600">{emailStats.bounceRate}</p>
              <p className="text-xs text-surface-400">
                {emailStats.totalBounced} {t("sentEmails.bounced")}
              </p>
            </div>
            <div
              className="cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => navigate("/sent-emails")}
            >
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <MessageSquare size={16} />
                <span>{t("dashboard.viewAllEmails")}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-brand-600">
                {t("dashboard.seeDetails")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Pipeline */}
      {pipeline && Object.keys(pipeline).length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-surface-900">Pipeline</h3>
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-4 shadow-sm">
            {[
              { key: "NEW", label: "New", color: "bg-gray-100 text-gray-700" },
              { key: "ENRICHING", label: "Enriching", color: "bg-yellow-100 text-yellow-700" },
              { key: "READY_TO_CONTACT", label: "Ready", color: "bg-blue-100 text-blue-700" },
              { key: "CONTACTED_EMAIL", label: "Contacted", color: "bg-indigo-100 text-indigo-700" },
              { key: "REPLIED", label: "Replied", color: "bg-purple-100 text-purple-700" },
              { key: "NEGOTIATING", label: "Negotiating", color: "bg-orange-100 text-orange-700" },
              { key: "WON", label: "Won", color: "bg-emerald-100 text-emerald-700" },
              { key: "LINK_VERIFIED", label: "Verified", color: "bg-green-100 text-green-700" },
              { key: "LOST", label: "Lost", color: "bg-red-100 text-red-700" },
            ].map((stage) => {
              const count = (pipeline as Record<string, number>)[stage.key] ?? 0;
              return (
                <div
                  key={stage.key}
                  className={`flex min-w-[90px] flex-1 cursor-pointer flex-col items-center rounded-lg p-3 transition-opacity hover:opacity-80 ${stage.color}`}
                  onClick={() => navigate(`/prospects?status=${stage.key}`)}
                >
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="mt-1 text-xs font-medium">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Today's Stats */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={20} className="text-brand-500" />
          <h3 className="text-lg font-semibold text-surface-900">
            {t("dashboard.todaysStats")}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label={t("dashboard.sentToMailwizz")}
            value={stats.sentToMailwizz}
            color="blue"
          />
          <StatsCard
            label={t("dashboard.repliesReceived")}
            value={stats.repliesReceived}
            color="blue"
          />
          <StatsCard
            label={t("dashboard.backlinksWon")}
            value={stats.backlinksWon}
            color="blue"
          />
          {Object.entries(stats.prospectsAddedBySource || {}).map(
            ([source, count]) => (
              <StatsCard
                key={source}
                label={`${t("dashboard.added")} (${source})`}
                value={count}
                color="blue"
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
