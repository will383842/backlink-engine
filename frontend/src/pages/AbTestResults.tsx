import { Trophy, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAbTestStats } from "@/hooks/useApi";
import type { AbTestStats } from "@/types";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const VARIANT_A_COLOR = "#338fff";
const VARIANT_B_COLOR = "#8b5cf6";

// ---------------------------------------------------------------------------
// Single campaign A/B card
// ---------------------------------------------------------------------------

function AbTestCard({ test }: { test: AbTestStats }) {
  const { t } = useTranslation();

  const chartData = [
    {
      metric: t("abTesting.openRate"),
      A: parseFloat(test.variantA.openRate) || 0,
      B: parseFloat(test.variantB.openRate) || 0,
    },
    {
      metric: t("abTesting.clickRate"),
      A: parseFloat(test.variantA.clickRate) || 0,
      B: parseFloat(test.variantB.clickRate) || 0,
    },
    {
      metric: t("abTesting.replyRate"),
      A: parseFloat(test.variantA.replyRate) || 0,
      B: parseFloat(test.variantB.replyRate) || 0,
    },
  ];

  const winnerColor =
    test.winner === "A"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : test.winner === "B"
        ? "bg-purple-100 text-purple-700 border-purple-200"
        : "bg-surface-100 text-surface-600 border-surface-200";

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            {test.campaignName}
          </h3>
          <p className="text-sm text-surface-500">
            {t("abTesting.language")}: {test.language.toUpperCase()}
          </p>
        </div>
        {test.winner ? (
          <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${winnerColor}`}>
            <Trophy size={16} />
            {t("abTesting.winner")}: {t("abTesting.variant")} {test.winner}
          </div>
        ) : (
          <span className="badge bg-surface-100 text-surface-600">
            {test.winnerLabel || t("abTesting.noWinnerYet")}
          </span>
        )}
      </div>

      {/* Side-by-side stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Variant A */}
        <div className={`rounded-xl border p-4 ${test.winner === "A" ? "border-blue-300 bg-blue-50/50" : "border-surface-200"}`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: VARIANT_A_COLOR }} />
            <span className="text-sm font-semibold text-surface-700">
              {t("abTesting.variant")} A
            </span>
            <span className="ml-auto text-xs text-surface-500">
              {test.variantA.sent} {t("abTesting.sent")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.opens")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantA.openRate}%</p>
              <p className="text-xs text-surface-400">{test.variantA.opened}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.clicks")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantA.clickRate}%</p>
              <p className="text-xs text-surface-400">{test.variantA.clicked}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.replies")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantA.replyRate}%</p>
              <p className="text-xs text-surface-400">{test.variantA.replied}</p>
            </div>
          </div>
        </div>

        {/* Variant B */}
        <div className={`rounded-xl border p-4 ${test.winner === "B" ? "border-purple-300 bg-purple-50/50" : "border-surface-200"}`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: VARIANT_B_COLOR }} />
            <span className="text-sm font-semibold text-surface-700">
              {t("abTesting.variant")} B
            </span>
            <span className="ml-auto text-xs text-surface-500">
              {test.variantB.sent} {t("abTesting.sent")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.opens")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantB.openRate}%</p>
              <p className="text-xs text-surface-400">{test.variantB.opened}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.clicks")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantB.clickRate}%</p>
              <p className="text-xs text-surface-400">{test.variantB.clicked}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">{t("abTesting.replies")}</p>
              <p className="text-lg font-bold text-surface-900">{test.variantB.replyRate}%</p>
              <p className="text-xs text-surface-400">{test.variantB.replied}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="metric" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
            <Legend />
            <Bar
              dataKey="A"
              name={`${t("abTesting.variant")} A`}
              fill={VARIANT_A_COLOR}
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="B"
              name={`${t("abTesting.variant")} B`}
              fill={VARIANT_B_COLOR}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AbTestResults() {
  const { t } = useTranslation();
  const { data: tests, isLoading } = useAbTestStats();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!tests?.length) {
    return (
      <div className="card text-center">
        <TrendingUp size={40} className="mx-auto mb-3 text-surface-300" />
        <p className="text-surface-500">{t("abTesting.noTests")}</p>
        <p className="mt-1 text-sm text-surface-400">{t("abTesting.noTestsDescription")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="card flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-50 to-purple-50">
        <TrendingUp size={24} className="text-brand-600" />
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            {t("abTesting.title")}
          </h3>
          <p className="text-sm text-surface-600">
            {tests.length} {t("abTesting.campaignsWithAb")}
          </p>
        </div>
      </div>

      {/* Test cards */}
      {tests.map((test) => (
        <AbTestCard key={test.campaignId} test={test} />
      ))}
    </div>
  );
}
