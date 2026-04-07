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
      return res.data as Record<string, number> | undefined;
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
  const todo = data?.todo ?? { prospectsReady: 0, formsToFill: 0 };
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

      {/* To-do */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList size={20} className="text-amber-500" />
          <h3 className="text-lg font-semibold text-surface-900">{t("dashboard.todo")}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatsCard
            label={t("dashboard.prospectsReady")}
            value={todo.prospectsReady}
            color="yellow"
            to="/prospects?status=READY_TO_CONTACT"
          />
          <StatsCard
            label={t("dashboard.formsToFill")}
            value={todo.formsToFill}
            color="yellow"
            to="/prospects?status=READY_TO_CONTACT"
          />
        </div>
      </section>

      {/* Opportunities */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-500" />
          <h3 className="text-lg font-semibold text-surface-900">
            {t("dashboard.opportunities")}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-1">
          <StatsCard
            label={t("dashboard.lostRecontactable")}
            value={opportunities.lostRecontactable}
            color="green"
            to="/recontact"
          />
        </div>
      </section>

      {/* Email Performance */}
      {emailStats && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Mail size={20} className="text-indigo-500" />
            <h3 className="text-lg font-semibold text-surface-900">Email Performance</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Mail size={16} />
                <span>Total Sent</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-surface-900">{emailStats.totalSent}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Eye size={16} />
                <span>Open Rate</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{emailStats.openRate}</p>
              <p className="text-xs text-surface-400">{emailStats.totalOpened} opened</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <MousePointer size={16} />
                <span>Click Rate</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-blue-600">{emailStats.clickRate}</p>
              <p className="text-xs text-surface-400">{emailStats.totalClicked} clicked</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <AlertCircle size={16} />
                <span>Bounce Rate</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-red-600">{emailStats.bounceRate}</p>
              <p className="text-xs text-surface-400">{emailStats.totalBounced} bounced</p>
            </div>
            <div
              className="cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => navigate("/sent-emails")}
            >
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <MessageSquare size={16} />
                <span>View All Emails</span>
              </div>
              <p className="mt-1 text-sm font-medium text-brand-600">See details &rarr;</p>
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
