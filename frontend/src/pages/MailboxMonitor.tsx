// ---------------------------------------------------------------------------
// Mailbox Monitor — per-inbox warmup & deliverability dashboard
// ---------------------------------------------------------------------------
// Shows KPIs for the 5 presse@* sending inboxes: sent, opens, bounces,
// complaints, health score. Plus timeline chart of sends/opens per inbox.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Mail, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import api from "@/lib/api";

type Health = "good" | "warning" | "bad" | "unknown";

interface InboxStat {
  fromEmail: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  health: Health;
}

interface StatsResponse {
  data: {
    inboxes: InboxStat[];
    totals: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      complained: number;
      openRate: number;
    };
    period: { days: number; since: string };
  };
}

interface TimelineRow {
  day: string;
  fromEmail: string;
  sent: number;
  opened: number;
}

const HEALTH_STYLES: Record<Health, { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }> = {
  good: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Chauffe bien", Icon: CheckCircle2 },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "À surveiller", Icon: AlertTriangle },
  bad: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Problème", Icon: AlertTriangle },
  unknown: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600", label: "Pas assez de données", Icon: RefreshCw },
};

const INBOX_COLORS: Record<string, string> = {
  "presse@hub-travelers.com": "#3b82f6",
  "presse@plane-liberty.com": "#10b981",
  "presse@planevilain.com": "#f59e0b",
  "presse@emilia-mullerd.com": "#ef4444",
  "presse@providers-expat.com": "#8b5cf6",
};

export default function MailboxMonitor() {
  const [days, setDays] = useState<number>(7);

  const { data, isLoading, refetch, isFetching } = useQuery<StatsResponse>({
    queryKey: ["mailbox-stats", days],
    queryFn: async () => {
      const res = await api.get(`/mailbox/stats?days=${days}`);
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: timelineData } = useQuery<{ data: { timeline: TimelineRow[] } }>({
    queryKey: ["mailbox-timeline", days],
    queryFn: async () => {
      const res = await api.get(`/mailbox/timeline?days=${Math.max(14, days)}`);
      return res.data;
    },
    refetchInterval: 60_000,
  });

  // Pivot timeline for Recharts: { day, "presse@...": sent, ... }
  const chartData = (() => {
    if (!timelineData?.data.timeline) return [] as Array<Record<string, string | number>>;
    const byDay = new Map<string, Record<string, string | number>>();
    for (const row of timelineData.data.timeline) {
      if (!byDay.has(row.day)) byDay.set(row.day, { day: row.day });
      byDay.get(row.day)![row.fromEmail] = row.opened;
    }
    return Array.from(byDay.values()).sort((a, b) =>
      String(a.day).localeCompare(String(b.day)),
    );
  })();

  const totals = data?.data.totals;
  const inboxes = data?.data.inboxes || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mailbox Monitor</h1>
          <p className="text-sm text-surface-600">
            Délivrabilité & warmup des 5 inboxes presse@*
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value={1}>24 heures</option>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm hover:bg-surface-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Envoyés" value={totals.sent} />
          <KpiCard label="Délivrés" value={totals.delivered} />
          <KpiCard
            label="Taux d'ouverture"
            value={`${totals.openRate}%`}
            tone={totals.openRate >= 25 ? "good" : totals.openRate >= 15 ? "warning" : "bad"}
          />
          <KpiCard label="Bounces" value={totals.bounced} tone={totals.bounced > 0 ? "warning" : "good"} />
          <KpiCard
            label="Plaintes"
            value={totals.complained}
            tone={totals.complained > 0 ? "bad" : "good"}
          />
        </div>
      )}

      {/* Per-inbox table */}
      <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
          <Mail size={18} className="text-surface-500" />
          <h2 className="font-semibold text-surface-900">Par inbox</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-xs uppercase text-surface-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Inbox</th>
                <th className="px-4 py-2 text-right font-medium">Envoyés</th>
                <th className="px-4 py-2 text-right font-medium">Ouverts</th>
                <th className="px-4 py-2 text-right font-medium">Taux</th>
                <th className="px-4 py-2 text-right font-medium">Clics</th>
                <th className="px-4 py-2 text-right font-medium">Bounces</th>
                <th className="px-4 py-2 text-right font-medium">Plaintes</th>
                <th className="px-4 py-2 text-left font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-surface-500">
                    Chargement…
                  </td>
                </tr>
              )}
              {!isLoading && inboxes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-surface-500">
                    Aucune donnée sur cette période.
                  </td>
                </tr>
              )}
              {inboxes.map((ib) => {
                const style = HEALTH_STYLES[ib.health];
                return (
                  <tr key={ib.fromEmail} className="hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: INBOX_COLORS[ib.fromEmail] || "#94a3b8" }}
                        />
                        <span className="font-mono text-xs">{ib.fromEmail}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{ib.sent}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{ib.opened}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {ib.openRate}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{ib.clicked}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {ib.bounced > 0 ? (
                        <span className="text-amber-600">{ib.bounced}</span>
                      ) : (
                        ib.bounced
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {ib.complained > 0 ? (
                        <span className="text-red-600 font-semibold">{ib.complained}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        <style.Icon size={12} />
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline chart */}
      <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
          <TrendingUp size={18} className="text-surface-500" />
          <h2 className="font-semibold text-surface-900">
            Ouvertures quotidiennes par inbox
          </h2>
        </div>
        <div className="p-4">
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Legend />
                {Object.entries(INBOX_COLORS).map(([email, color]) => (
                  <Line
                    key={email}
                    type="monotone"
                    dataKey={email}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    name={email.replace("presse@", "")}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Help block */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="mb-1 font-medium">Comment lire le taux d'ouverture :</p>
        <ul className="list-disc pl-5 text-blue-800">
          <li>
            <strong>&gt; 40 %</strong> — Chauffe puissamment, tu peux augmenter le volume
          </li>
          <li>
            <strong>25–40 %</strong> — Chauffe modérément, maintiens le rythme
          </li>
          <li>
            <strong>15–25 %</strong> — Neutre, contenu à améliorer ou warmup insuffisant
          </li>
          <li>
            <strong>&lt; 15 %</strong> — Dégrade, arrête et laisse Mailflow seul 1-2 semaines
          </li>
        </ul>
        <p className="mt-2 text-xs text-blue-700">
          Note : Apple Mail Privacy Protection & bots anti-phishing gonflent le taux de
          ~15-30 % (pré-fetch des pixels). Comparer plutôt inter-inbox.
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "warning" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-surface-900";
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
