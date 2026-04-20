import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import { useTranslation } from "@/i18n";

// Raw API shape (dict-keyed maps + campaign array).
interface RawReportsData {
  overview: {
    totalProspects: number;
    totalBacklinks: number;
    liveBacklinks: number;
    totalCampaigns: number;
    totalReplies: number;
    totalWon: number;
  };
  backlinksPerMonth: Record<string, number>;
  pipeline: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  campaignStats: Array<{
    id: number;
    name: string;
    enrolled: number;
    replied: number;
    won: number;
    replyRate: number;
  }>;
}

// Chart-friendly shape (arrays of points) — derived from RawReportsData.
interface ReportsData {
  overview: RawReportsData["overview"];
  backlinksPerMonth: { month: string; count: number }[];
  pipelineFunnel: { stage: string; count: number }[];
  replyRateByCampaign: { campaign: string; rate: number }[];
  prospectsBySource: { source: string; count: number }[];
  prospectsByCountry: { country: string; count: number }[];
}

function normalizeReports(raw: RawReportsData): ReportsData {
  const mapToArray = <T extends string>(obj: Record<string, number> | undefined, keyName: T) =>
    Object.entries(obj ?? {})
      .map(([k, v]) => ({ [keyName]: k, count: v } as { [K in T]: string } & { count: number }))
      .sort((a, b) => b.count - a.count);

  return {
    overview: raw.overview,
    backlinksPerMonth: Object.entries(raw.backlinksPerMonth ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
    pipelineFunnel: mapToArray(raw.pipeline, "stage") as { stage: string; count: number }[],
    prospectsBySource: mapToArray(raw.sourceBreakdown, "source") as { source: string; count: number }[],
    prospectsByCountry: (mapToArray(raw.countryBreakdown, "country") as { country: string; count: number }[]).slice(0, 12),
    replyRateByCampaign: (raw.campaignStats ?? []).map((c) => ({ campaign: c.name, rate: c.replyRate })),
  };
}

const COLORS = [
  "#338fff",
  "#1459e1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export default function Reports() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<ReportsData>({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await api.get("/reports");
      const raw = (res.data?.data ?? res.data) as RawReportsData;
      return normalizeReports(raw);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card text-center text-surface-500">
        {t("reports.failedToLoad")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Backlinks per month */}
      <section className="card">
        <h3 className="mb-4 text-lg font-semibold text-surface-900">
          {t("reports.backlinksPerMonth")}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.backlinksPerMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                name={t("reports.backlinksLabel")}
                stroke="#338fff"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Pipeline funnel */}
      <section className="card">
        <h3 className="mb-4 text-lg font-semibold text-surface-900">
          {t("reports.pipelineFunnel")}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.pipelineFunnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip />
              <Bar dataKey="count" name={t("reports.prospectsLabel")} radius={[6, 6, 0, 0]}>
                {(data.pipelineFunnel || []).map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Reply rate by campaign */}
        <section className="card">
          <h3 className="mb-4 text-lg font-semibold text-surface-900">
            {t("reports.replyRateByCampaign")}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.replyRateByCampaign}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="campaign"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar
                  dataKey="rate"
                  name={t("reports.replyRateLabel")}
                  fill="#1459e1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Prospects by source */}
        <section className="card">
          <h3 className="mb-4 text-lg font-semibold text-surface-900">
            {t("reports.prospectsBySource")}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.prospectsBySource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { source?: string; percent?: number }) =>
                    `${entry.source ?? ""} (${((entry.percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="source"
                >
                  {(data.prospectsBySource || []).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Prospects by country */}
      <section className="card">
        <h3 className="mb-4 text-lg font-semibold text-surface-900">
          {t("reports.prospectsByCountry")}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.prospectsByCountry}
              layout="vertical"
              margin={{ left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis
                dataKey="country"
                type="category"
                tick={{ fontSize: 12, fill: "#64748b" }}
                width={60}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name={t("reports.prospectsLabel")}
                fill="#338fff"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
