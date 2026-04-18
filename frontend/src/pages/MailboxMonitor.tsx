// ---------------------------------------------------------------------------
// Mailbox Monitor V2 — readiness + warmup + blacklists + cold stats
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Mail, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, Shield, ExternalLink,
  Activity, Clock, ShieldCheck, ShieldAlert,
} from "lucide-react";
import api from "@/lib/api";

type Health = "good" | "warning" | "bad" | "unknown";
type Verdict = "ready" | "wait" | "problem";

interface InboxStat {
  fromEmail: string; sent: number; delivered: number; opened: number; clicked: number;
  bounced: number; hardBounced: number; complained: number;
  openRate: number; clickRate: number; bounceRate: number; health: Health;
}

interface StatsResponse {
  data: {
    inboxes: InboxStat[];
    totals: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number; openRate: number };
    period: { days: number };
  };
}

interface TimelineRow { day: string; fromEmail: string; sent: number; opened: number }

interface WarmupStat {
  fromEmail: string; today: number; last7Days: number; totalAll: number;
  success: number; failures: number; failures72h: number; lastFailure: string | null;
  successRate: number; lastActivity: string | null;
}

interface WarmupResponse { data: { inboxes: WarmupStat[] } }

interface BlacklistResult { name: string; listed: boolean; reply: string | null }

interface BlacklistResponse { data: { ip: string; results: BlacklistResult[]; listedCount: number } }

interface ReadinessScore {
  fromEmail: string; score: number; verdict: Verdict;
  checks: Array<{ name: string; passed: boolean; weight: number; detail: string }>;
}

interface ReadinessResponse {
  data: {
    scores: ReadinessScore[];
    blacklists: { ip: string; results: BlacklistResult[]; listedCount: number };
    postmasterToolsUrl: string;
    microsoftSndsUrl: string;
  };
}

const HEALTH_STYLES: Record<Health, { bg: string; text: string; label: string }> = {
  good: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Chauffe bien" },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "À surveiller" },
  bad: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Problème" },
  unknown: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600", label: "Pas assez de données" },
};

const VERDICT_STYLES: Record<Verdict, { bg: string; text: string; label: string; Icon: typeof ShieldCheck }> = {
  ready: { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-700", label: "PRÊT pour cold", Icon: ShieldCheck },
  wait: { bg: "bg-amber-50 border-amber-300", text: "text-amber-700", label: "EN WARMUP", Icon: Clock },
  problem: { bg: "bg-red-50 border-red-300", text: "text-red-700", label: "PROBLÈME", Icon: ShieldAlert },
};

const INBOX_COLORS: Record<string, string> = {
  "presse@hub-travelers.com": "#3b82f6",
  "presse@plane-liberty.com": "#10b981",
  "presse@planevilain.com": "#f59e0b",
  "presse@emilia-mullerd.com": "#ef4444",
  "presse@providers-expat.com": "#8b5cf6",
};

const DOMAIN_OF = (email: string) => email.split("@")[1] ?? email;

function formatAge(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso.replace(" ", "T").replace(/\+\d{4}$/, "Z")).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return "< 1 min";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return `${Math.floor(diff / 86_400_000)} j`;
}

export default function MailboxMonitor() {
  const [days, setDays] = useState(7);

  const readinessQuery = useQuery<ReadinessResponse>({
    queryKey: ["mailbox-readiness"],
    queryFn: async () => (await api.get("/mailbox/readiness")).data,
    refetchInterval: 60_000,
  });

  const statsQuery = useQuery<StatsResponse>({
    queryKey: ["mailbox-stats", days],
    queryFn: async () => (await api.get(`/mailbox/stats?days=${days}`)).data,
    refetchInterval: 60_000,
  });

  const warmupQuery = useQuery<WarmupResponse>({
    queryKey: ["mailbox-warmup"],
    queryFn: async () => (await api.get("/mailbox/warmup-stats")).data,
    refetchInterval: 120_000,
  });

  const timelineQuery = useQuery<{ data: { timeline: Array<{ day: string; fromEmail: string; sends: number; receives: number }> } }>({
    queryKey: ["mailbox-warmup-timeline", days],
    queryFn: async () => (await api.get(`/mailbox/warmup-timeline?days=${Math.max(14, days)}`)).data,
    refetchInterval: 120_000,
  });

  const refreshAll = () => {
    readinessQuery.refetch();
    statsQuery.refetch();
    warmupQuery.refetch();
    timelineQuery.refetch();
  };
  const isFetching = readinessQuery.isFetching || statsQuery.isFetching || warmupQuery.isFetching;

  const totals = statsQuery.data?.data.totals;
  const coldInboxes = statsQuery.data?.data.inboxes ?? [];
  const warmupInboxes = warmupQuery.data?.data.inboxes ?? [];
  const scores = readinessQuery.data?.data.scores ?? [];
  const bl = readinessQuery.data?.data.blacklists;

  // Pivot timeline for Recharts (sends + receives = total warmup activity)
  const chartData = (() => {
    const tl = timelineQuery.data?.data.timeline ?? [];
    const byDay = new Map<string, Record<string, string | number>>();
    for (const row of tl) {
      if (!byDay.has(row.day)) byDay.set(row.day, { day: row.day });
      byDay.get(row.day)![row.fromEmail] = row.sends + row.receives;
    }
    return Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mailbox Monitor</h1>
          <p className="text-sm text-surface-600">
            Délivrabilité, warmup et readiness des 5 inboxes presse@*
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
            type="button" onClick={refreshAll} disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm hover:bg-surface-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Section 1 : READINESS par inbox */}
      <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
          <Shield size={18} className="text-surface-500" />
          <h2 className="font-semibold text-surface-900">Readiness pour campagnes cold</h2>
          <span className="ml-auto text-xs text-surface-500">Score agrégé /100</span>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {scores.length === 0 && (
            <div className="col-span-full text-center text-sm text-surface-500 py-6">
              {readinessQuery.isLoading ? "Chargement…" : "Aucune donnée"}
            </div>
          )}
          {scores.map((s) => {
            const v = VERDICT_STYLES[s.verdict];
            return (
              <div key={s.fromEmail} className={`rounded-lg border p-3 ${v.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: INBOX_COLORS[s.fromEmail] }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: INBOX_COLORS[s.fromEmail] }} />
                    {s.fromEmail.replace("presse@", "")}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-surface-900">{s.score}</span>
                </div>
                <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${v.text}`}>
                  <v.Icon size={14} />
                  {v.label}
                </span>
                <ul className="mt-3 space-y-1 text-xs">
                  {s.checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className={c.passed ? "text-emerald-600" : "text-red-500"}>
                        {c.passed ? "✓" : "✗"}
                      </span>
                      <span className="text-surface-700">{c.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2 : Warmup Mailflow (PMTA) */}
      <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
          <Activity size={18} className="text-surface-500" />
          <h2 className="font-semibold text-surface-900">Warmup Mailflow</h2>
          <span className="ml-auto text-xs text-surface-500">Lu depuis les logs PMTA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-xs uppercase text-surface-600">
              <tr>
                <th className="px-4 py-2 text-left">Inbox</th>
                <th className="px-4 py-2 text-right">Aujourd'hui</th>
                <th className="px-4 py-2 text-right">7 jours</th>
                <th className="px-4 py-2 text-right">Succès</th>
                <th className="px-4 py-2 text-right">Échecs (7j)</th>
                <th className="px-4 py-2 text-right">Échecs (72h)</th>
                <th className="px-4 py-2 text-right">Taux</th>
                <th className="px-4 py-2 text-left">Dernière activité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {warmupQuery.isLoading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-surface-500">Chargement…</td></tr>
              )}
              {warmupInboxes.map((w) => (
                <tr key={w.fromEmail} className="hover:bg-surface-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: INBOX_COLORS[w.fromEmail] || "#94a3b8" }} />
                      <span className="font-mono text-xs">{w.fromEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{w.today}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{w.last7Days}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{w.success}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {w.failures > 0 ? <span className="text-surface-500" title="Inclut les vieilles erreurs Spamhaus du 10-11 avril">{w.failures}</span> : 0}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {w.failures72h > 0 ? (
                      <span className="text-red-600 font-semibold" title={w.lastFailure ? `Dernier échec: ${w.lastFailure}` : undefined}>{w.failures72h}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{w.totalAll > 0 ? `${w.successRate}%` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-surface-600">
                    {w.lastActivity ? `il y a ${formatAge(w.lastActivity)}` : "aucune"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3 : Blacklists */}
      {bl && (
        <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
            {bl.listedCount === 0 ? <ShieldCheck size={18} className="text-emerald-600" /> : <ShieldAlert size={18} className="text-red-600" />}
            <h2 className="font-semibold text-surface-900">Blacklists · IP {bl.ip}</h2>
            <span className={`ml-auto text-xs font-semibold ${bl.listedCount === 0 ? "text-emerald-700" : "text-red-700"}`}>
              {bl.listedCount === 0 ? `Clean (${bl.results.length}/${bl.results.length})` : `⚠️ Listed sur ${bl.listedCount} RBL`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4 lg:grid-cols-7">
            {bl.results.map((r) => (
              <div key={r.name} className={`rounded-md border px-2 py-1.5 text-xs ${r.listed ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                <div className="flex items-center gap-1 font-mono truncate">
                  {r.listed ? "✗" : "✓"} {r.name.split(".")[0]}
                </div>
                <div className="text-[10px] opacity-70 truncate">{r.listed ? r.reply || "listed" : "clean"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4 : Cold campaign stats (existant) */}
      {totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Cold envoyés" value={totals.sent} />
            <KpiCard label="Délivrés" value={totals.delivered} />
            <KpiCard label="Taux ouverture" value={`${totals.openRate}%`}
              tone={totals.openRate >= 25 ? "good" : totals.openRate >= 15 ? "warning" : "bad"} />
            <KpiCard label="Bounces" value={totals.bounced} tone={totals.bounced > 0 ? "warning" : "good"} />
            <KpiCard label="Plaintes" value={totals.complained} tone={totals.complained > 0 ? "bad" : "good"} />
          </div>

          <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
              <Mail size={18} className="text-surface-500" />
              <h2 className="font-semibold text-surface-900">Campagnes cold — par inbox</h2>
              <span className="ml-auto text-xs text-surface-500">Via backlink-engine</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-xs uppercase text-surface-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Inbox</th>
                    <th className="px-4 py-2 text-right">Envoyés</th>
                    <th className="px-4 py-2 text-right">Ouverts</th>
                    <th className="px-4 py-2 text-right">Taux</th>
                    <th className="px-4 py-2 text-right">Clics</th>
                    <th className="px-4 py-2 text-right">Bounces</th>
                    <th className="px-4 py-2 text-right">Plaintes</th>
                    <th className="px-4 py-2 text-left">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {coldInboxes.map((ib) => {
                    const style = HEALTH_STYLES[ib.health];
                    return (
                      <tr key={ib.fromEmail} className="hover:bg-surface-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: INBOX_COLORS[ib.fromEmail] || "#94a3b8" }} />
                            <span className="font-mono text-xs">{ib.fromEmail}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{ib.sent}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{ib.opened}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{ib.openRate}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{ib.clicked}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {ib.bounced > 0 ? <span className="text-amber-600">{ib.bounced}</span> : ib.bounced}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {ib.complained > 0 ? <span className="text-red-600 font-semibold">{ib.complained}</span> : 0}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
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
        </>
      )}

      {/* Section 5 : External monitoring (configuré) */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-900">
          <ShieldCheck size={16} />
          Monitoring externe — configuré ✓
        </div>
        <p className="mb-3 text-xs text-emerald-800">
          Complément indispensable au dashboard interne pour le <strong>placement Inbox/Spam réel</strong>
          chez Gmail et Outlook. Les scores reputation s&apos;affichent directement dans les dashboards officiels.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <a
            href="https://postmaster.google.com/managedomains"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-emerald-300 bg-white px-3 py-2 hover:bg-emerald-50"
          >
            <div>
              <div className="font-medium text-emerald-900">Google Postmaster Tools →</div>
              <div className="text-xs text-emerald-700">Reputation Gmail par domaine · 10 domaines vérifiés</div>
            </div>
            <ExternalLink size={14} className="text-emerald-700" />
          </a>
          <a
            href="https://sendersupport.olc.protection.outlook.com/snds/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-emerald-300 bg-white px-3 py-2 hover:bg-emerald-50"
          >
            <div>
              <div className="font-medium text-emerald-900">Microsoft SNDS →</div>
              <div className="text-xs text-emerald-700">Reputation Outlook/Hotmail par IP</div>
            </div>
            <ExternalLink size={14} className="text-emerald-700" />
          </a>
        </div>
      </div>

      {/* Section 6 : Timeline chart */}
      <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
          <TrendingUp size={18} className="text-surface-500" />
          <h2 className="font-semibold text-surface-900">Activité warmup quotidienne par inbox (envois + réceptions)</h2>
        </div>
        <div className="p-4">
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Legend />
                {Object.entries(INBOX_COLORS).map(([email, color]) => (
                  <Line key={email} type="monotone" dataKey={email} stroke={color}
                    strokeWidth={2} dot={false} name={DOMAIN_OF(email)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Help block */}
      <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 text-xs text-surface-700">
        <p className="mb-1 font-medium">Lecture du score readiness :</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><strong>80-100 (vert)</strong> — prêt à envoyer du cold</li>
          <li><strong>50-79 (orange)</strong> — continue le warmup, pas encore</li>
          <li><strong>&lt; 50 ou blacklist (rouge)</strong> — problème à résoudre d'abord</li>
        </ul>
        <p className="mt-2 text-surface-600">
          Le score combine warmup Mailflow (50%), blacklists (25%), délivrabilité cold (25%).
          Le vrai placement Inbox/Spam nécessite Google Postmaster Tools (ci-dessus).
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warning" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-surface-900";
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
