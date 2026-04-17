// ---------------------------------------------------------------------------
// VPS Health — server + mail-stack monitoring
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import {
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import api from "@/lib/api";

type ServiceStatus = "active" | "inactive" | "failed" | "unknown";
type Overall = "healthy" | "warning" | "critical";

interface HealthResponse {
  data: {
    timestamp: string;
    system: {
      cpu: { loadAvg1: number; loadAvg5: number; loadAvg15: number; cores: number };
      memory: { totalMb: number; usedMb: number; freeMb: number; percent: number };
      disk: { totalGb: number; usedGb: number; freeGb: number; percent: number };
      uptimeSeconds: number;
    };
    services: Array<{ name: string; status: ServiceStatus; label: string }>;
    mail: {
      pmtaQueueSize: number | null;
      postfixQueueSize: number | null;
      lastPmtaActivity: string | null;
    };
    overall: Overall;
  };
}

const SERVICE_ICON: Record<ServiceStatus, { Icon: typeof CheckCircle2; color: string; label: string }> = {
  active: { Icon: CheckCircle2, color: "text-emerald-600", label: "Actif" },
  inactive: { Icon: AlertTriangle, color: "text-amber-600", label: "Inactif" },
  failed: { Icon: XCircle, color: "text-red-600", label: "KO" },
  unknown: { Icon: HelpCircle, color: "text-gray-500", label: "Inconnu" },
};

const OVERALL_STYLES: Record<Overall, { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Sain" },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "À surveiller" },
  critical: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Critique" },
};

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Gauge({
  label,
  value,
  max,
  unit,
  Icon,
}: {
  label: string;
  value: number;
  max?: number;
  unit: string;
  Icon: typeof Cpu;
}) {
  const percent = max ? Math.min(100, (value / max) * 100) : value;
  const color =
    percent > 90 ? "bg-red-500" : percent > 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-surface-500" />
          <span className="text-sm font-medium text-surface-700">{label}</span>
        </div>
        <span className="tabular-nums text-sm font-semibold text-surface-900">
          {value}
          {unit}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function VpsHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ["vps-health"],
    queryFn: async () => {
      const res = await api.get("/vps-health");
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const h = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">VPS Health</h1>
          <p className="text-sm text-surface-600">
            Monitoring serveur & stack mail (rafraîchi auto toutes les 30 s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {h && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${OVERALL_STYLES[h.overall].bg} ${OVERALL_STYLES[h.overall].text}`}
            >
              État : {OVERALL_STYLES[h.overall].label}
            </span>
          )}
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

      {isLoading && !h && (
        <div className="rounded-lg border border-surface-200 bg-white p-8 text-center text-surface-500 shadow-sm">
          Chargement…
        </div>
      )}

      {h && (
        <>
          {/* System gauges */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Gauge
              label={`CPU Load (${h.system.cpu.cores} cores)`}
              value={Math.round(h.system.cpu.loadAvg5 * 100) / 100}
              max={h.system.cpu.cores}
              unit=""
              Icon={Cpu}
            />
            <Gauge
              label={`RAM (${h.system.memory.usedMb}/${h.system.memory.totalMb} MB)`}
              value={h.system.memory.percent}
              unit="%"
              Icon={MemoryStick}
            />
            <Gauge
              label={`Disque (${h.system.disk.usedGb}/${h.system.disk.totalGb} GB)`}
              value={h.system.disk.percent}
              unit="%"
              Icon={HardDrive}
            />
          </div>

          {/* Services */}
          <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
              <Server size={18} className="text-surface-500" />
              <h2 className="font-semibold text-surface-900">Services</h2>
            </div>
            <div className="grid grid-cols-1 gap-0 divide-y divide-surface-100 md:grid-cols-2 md:divide-y-0 md:divide-x">
              {h.services.map((svc) => {
                const s = SERVICE_ICON[svc.status];
                return (
                  <div key={svc.name} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-surface-700">{svc.label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.color}`}>
                      <s.Icon size={16} />
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mail stack */}
          <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
              <Mail size={18} className="text-surface-500" />
              <h2 className="font-semibold text-surface-900">Stack mail</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <InfoBox
                label="Queue PMTA"
                value={h.mail.pmtaQueueSize === null ? "—" : String(h.mail.pmtaQueueSize)}
                hint={h.mail.pmtaQueueSize && h.mail.pmtaQueueSize > 10 ? "⚠️ queue élevée" : "✓ sain"}
              />
              <InfoBox
                label="Queue Postfix"
                value={h.mail.postfixQueueSize === null ? "—" : String(h.mail.postfixQueueSize)}
                hint={h.mail.postfixQueueSize && h.mail.postfixQueueSize > 20 ? "⚠️ queue élevée" : "✓ sain"}
              />
              <InfoBox
                label="Dernier envoi PMTA"
                value={h.mail.lastPmtaActivity || "—"}
                hint=""
              />
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              Uptime : <strong className="text-surface-700">{formatUptime(h.system.uptimeSeconds)}</strong>
            </span>
            <span>
              Dernière mesure : {new Date(h.timestamp).toLocaleTimeString("fr-FR")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function InfoBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-surface-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-surface-900 truncate">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-surface-600">{hint}</p>}
    </div>
  );
}
