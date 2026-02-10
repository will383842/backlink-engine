import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  BarChart3,
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

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get("/dashboard/today");
      return res.data as DashboardData;
    },
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
            value={data.urgent.repliesToHandle}
            color="red"
            to="/replies"
          />
          <StatsCard
            label={t("dashboard.bounces")}
            value={data.urgent.bounces}
            color="red"
            to="/replies?category=BOUNCE"
          />
          <StatsCard
            label={t("dashboard.lostBacklinks")}
            value={data.urgent.lostBacklinks}
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
            value={data.todo.prospectsReady}
            color="yellow"
            to="/prospects?status=READY_TO_CONTACT"
          />
          <StatsCard
            label={t("dashboard.formsToFill")}
            value={data.todo.formsToFill}
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
            value={data.opportunities.lostRecontactable}
            color="green"
            to="/recontact"
          />
        </div>
      </section>

      {/* Stats */}
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
            value={data.stats.sentToMailwizz}
            color="blue"
          />
          <StatsCard
            label={t("dashboard.repliesReceived")}
            value={data.stats.repliesReceived}
            color="blue"
          />
          <StatsCard
            label={t("dashboard.backlinksWon")}
            value={data.stats.backlinksWon}
            color="blue"
          />
          {Object.entries(data.stats.prospectsAddedBySource).map(
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
