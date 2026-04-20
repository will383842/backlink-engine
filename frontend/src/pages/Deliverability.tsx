import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface DomainHealth {
  domain: string;
  sent: number;
  bounced: number;
  complained: number;
  bounceRate: number;
  complaintRate: number;
  healthy: boolean;
  reason?: string;
}

interface DeliverabilityOverview {
  domains: DomainHealth[];
  scrapeCoverage: { totalReady: number; withHomepage: number; percentage: number };
  window7d: {
    sent: number;
    bounced: number;
    complained: number;
    bounceRate: number;
    complaintRate: number;
  };
}

function formatPct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export default function Deliverability() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["deliverability-overview"],
    queryFn: async () => {
      const res = await api.get("/sent-emails/deliverability-overview");
      return res.data?.data as DeliverabilityOverview;
    },
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  if (isLoading || !data) {
    return <div className="p-6 text-surface-600">Chargement…</div>;
  }

  const { domains, scrapeCoverage, window7d } = data;
  const healthyCount = domains.filter((d) => d.healthy).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">📬 Délivrabilité</h1>
          <p className="text-sm text-surface-600 mt-1">
            Santé des domaines d'envoi, bounce/complaint rate, couverture scraping — fenêtre 7 jours glissante.
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm">
          Rafraîchir
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-xs text-surface-500 uppercase tracking-wide">Envoyés 7j</div>
          <div className="text-2xl font-bold text-surface-900 mt-1">{window7d.sent.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-xs text-surface-500 uppercase tracking-wide">Bounce rate</div>
          <div className={`text-2xl font-bold mt-1 ${window7d.bounceRate > 0.05 ? "text-red-600" : window7d.bounceRate > 0.02 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatPct(window7d.bounceRate)}
          </div>
          <div className="text-xs text-surface-500 mt-1">{window7d.bounced} rejetés</div>
        </div>
        <div className="card">
          <div className="text-xs text-surface-500 uppercase tracking-wide">Complaint rate</div>
          <div className={`text-2xl font-bold mt-1 ${window7d.complaintRate > 0.01 ? "text-red-600" : window7d.complaintRate > 0.003 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatPct(window7d.complaintRate)}
          </div>
          <div className="text-xs text-surface-500 mt-1">{window7d.complained} plaintes</div>
        </div>
        <div className="card">
          <div className="text-xs text-surface-500 uppercase tracking-wide">Domaines sains</div>
          <div className="text-2xl font-bold text-surface-900 mt-1">
            {healthyCount}<span className="text-surface-400">/{domains.length}</span>
          </div>
          {healthyCount < domains.length && (
            <div className="text-xs text-red-600 mt-1">⚠ {domains.length - healthyCount} en pause</div>
          )}
        </div>
      </div>

      {/* Scrape coverage */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-surface-900">Couverture scraping homepage</h3>
          <span className="text-sm text-surface-600">
            {scrapeCoverage.withHomepage} / {scrapeCoverage.totalReady} ({scrapeCoverage.percentage.toFixed(1)}%)
          </span>
        </div>
        <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${scrapeCoverage.percentage}%` }}
          />
        </div>
        <p className="text-xs text-surface-500 mt-2">
          Plus le pourcentage est élevé, plus les emails auto-générés peuvent personnaliser
          leurs références aux sites des prospects (titre homepage, articles récents, about).
        </p>
      </div>

      {/* Per-domain health table */}
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-semibold text-surface-900 mb-3">Santé par domaine (rotation envoi)</h3>
        {domains.length === 0 ? (
          <p className="text-sm text-surface-500 italic">Aucun envoi dans les 7 derniers jours.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-xs text-surface-500 uppercase tracking-wide">
                <th className="text-left py-2 px-3">Domaine</th>
                <th className="text-right py-2 px-3">Envoyés</th>
                <th className="text-right py-2 px-3">Bounces</th>
                <th className="text-right py-2 px-3">Plaintes</th>
                <th className="text-right py-2 px-3">Bounce %</th>
                <th className="text-right py-2 px-3">Plaintes %</th>
                <th className="text-center py-2 px-3">État</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domain} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="py-2 px-3 font-mono text-xs">{d.domain}</td>
                  <td className="text-right py-2 px-3">{d.sent.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{d.bounced}</td>
                  <td className="text-right py-2 px-3">{d.complained}</td>
                  <td className={`text-right py-2 px-3 ${d.bounceRate > 0.05 ? "text-red-600 font-semibold" : ""}`}>
                    {formatPct(d.bounceRate)}
                  </td>
                  <td className={`text-right py-2 px-3 ${d.complaintRate > 0.01 ? "text-red-600 font-semibold" : ""}`}>
                    {formatPct(d.complaintRate)}
                  </td>
                  <td className="text-center py-2 px-3">
                    {d.healthy ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                        ✓ Actif
                      </span>
                    ) : (
                      <span title={d.reason} className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                        ⏸ Pausé
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info footer */}
      <div className="text-xs text-surface-500 bg-surface-50 rounded p-3">
        ℹ️ Un domaine est automatiquement pausé dans la rotation d'envoi dès que son bounce
        rate dépasse 5% ou son complaint rate dépasse 1% sur 7 jours (min 20 envois). La
        réputation reprend quand les stats redescendent sous le seuil.
      </div>
    </div>
  );
}
