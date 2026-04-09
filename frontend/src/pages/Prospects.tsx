import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Users, Mail, FileText, Globe } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api";
import type { Prospect, ProspectStatus, PaginatedResponse, Tag } from "@/types";
import { useTranslation } from "@/i18n";

// ── Type labels & colors ──
const SOURCE_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  presse: { label: "Presse", emoji: "📰", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  ecole: { label: "Ecoles", emoji: "🏫", color: "bg-blue-100 text-blue-700 border-blue-200" },
  youtubeur: { label: "YouTubeurs", emoji: "▶️", color: "bg-red-100 text-red-700 border-red-200" },
  influenceur: { label: "Influenceurs", emoji: "✨", color: "bg-pink-100 text-pink-700 border-pink-200" },
  consulat: { label: "Consulats", emoji: "🏛️", color: "bg-amber-100 text-amber-700 border-amber-200" },
  avocat: { label: "Avocats", emoji: "⚖️", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  association: { label: "Associations", emoji: "🤝", color: "bg-teal-100 text-teal-700 border-teal-200" },
  alliance_francaise: { label: "Alliance Fr.", emoji: "🇫🇷", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ufe: { label: "UFE", emoji: "🌍", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  instagrammeur: { label: "Instagram", emoji: "📸", color: "bg-purple-100 text-purple-700 border-purple-200" },
  communaute_expat: { label: "Communautes", emoji: "👥", color: "bg-orange-100 text-orange-700 border-orange-200" },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  blogger: { label: "Blogueurs", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  influencer: { label: "Influenceurs", color: "bg-pink-50 text-pink-700 border-pink-200" },
  media: { label: "Medias", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  association: { label: "Institutionnel", color: "bg-amber-50 text-amber-700 border-amber-200" },
  corporate: { label: "Services B2B", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partner: { label: "Partenaires", color: "bg-teal-50 text-teal-700 border-teal-200" },
  other: { label: "Autres", color: "bg-surface-50 text-surface-600 border-surface-200" },
};

function getCountryFlag(code: string): string {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch { return code; }
}

const STATUS_OPTIONS: ProspectStatus[] = [
  "NEW",
  "ENRICHING",
  "READY_TO_CONTACT",
  "CONTACTED_EMAIL",
  "CONTACTED_MANUAL",
  "FOLLOWUP_DUE",
  "REPLIED",
  "NEGOTIATING",
  "WON",
  "LINK_PENDING",
  "LINK_VERIFIED",
  "LINK_LOST",
  "RE_CONTACTED",
  "LOST",
  "DO_NOT_CONTACT",
];

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-surface-100 text-surface-700",
  ENRICHING: "bg-blue-100 text-blue-700",
  READY_TO_CONTACT: "bg-cyan-100 text-cyan-700",
  CONTACTED_EMAIL: "bg-indigo-100 text-indigo-700",
  CONTACTED_MANUAL: "bg-indigo-100 text-indigo-700",
  FOLLOWUP_DUE: "bg-amber-100 text-amber-700",
  REPLIED: "bg-purple-100 text-purple-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LINK_PENDING: "bg-blue-100 text-blue-700",
  LINK_VERIFIED: "bg-emerald-100 text-emerald-700",
  LINK_LOST: "bg-red-100 text-red-700",
  RE_CONTACTED: "bg-purple-100 text-purple-700",
  LOST: "bg-red-100 text-red-700",
  DO_NOT_CONTACT: "bg-surface-800 text-white",
};

interface Filters {
  status: string;
  country: string;
  language: string;
  tier: string;
  source: string;
  scoreMin: string;
  scoreMax: string;
  search: string;
  tagId: string;
}

export default function Prospects() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    country: "",
    language: "",
    tier: "",
    source: "",
    scoreMin: "",
    scoreMax: "",
    search: "",
    tagId: "",
  });

  // Debounced search value (400ms)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const updateFilter = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      if (key !== "search") {
        setPage(1);
      }
    },
    []
  );

  // Fetch all tags for filter dropdown
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await api.get("/tags");
      return res.data;
    },
  });

  const tags = (tagsData?.tags ?? []) as Tag[];

  // Stats by type
  const { data: statsData } = useQuery({
    queryKey: ["prospects-stats"],
    queryFn: async () => {
      const res = await api.get("/prospects/stats-by-type");
      return res.data?.data as {
        total: number;
        byCategory: { category: string; count: number }[];
        bySourceType: { type: string; count: number }[];
        byStatus: { status: string; count: number }[];
        byContactMethod: { method: string; count: number }[];
        byLanguage: { language: string; count: number }[];
        byCountry: { country: string; count: number }[];
      };
    },
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Prospect>>({
    queryKey: ["prospects", page, { ...filters, search: debouncedSearch }],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (filters.status) params.status = filters.status;
      if (filters.country) params.country = filters.country;
      if (filters.language) params.language = filters.language;
      if (filters.tier) params.tier = filters.tier;
      if (filters.source) params.source = filters.source;
      if (filters.scoreMin) params.scoreMin = filters.scoreMin;
      if (filters.scoreMax) params.scoreMax = filters.scoreMax;
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.tagId) params.tagId = filters.tagId;
      const res = await api.get("/prospects", { params });
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {statsData && (
        <div className="space-y-4">
          {/* Total + Contact Method */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500"><Users size={16} /> Total</div>
              <p className="mt-1 text-2xl font-bold text-surface-900">{statsData.total}</p>
            </div>
            {statsData.byContactMethod.map((m) => {
              const cfg: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                email_only: { label: "Email", icon: <Mail size={16} />, color: "text-emerald-600" },
                form_only: { label: "Formulaire", icon: <FileText size={16} />, color: "text-blue-600" },
                email_and_form: { label: "Email + Form", icon: <Mail size={16} />, color: "text-indigo-600" },
                none: { label: "Sans contact", icon: <Users size={16} />, color: "text-surface-400" },
              };
              const c = cfg[m.method] ?? { label: m.method, icon: null, color: "text-surface-600" };
              return (
                <div key={m.method} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className={`flex items-center gap-2 text-sm ${c.color}`}>{c.icon} {c.label}</div>
                  <p className={`mt-1 text-2xl font-bold ${c.color}`}>{m.count}</p>
                </div>
              );
            })}
          </div>

          {/* By Category (BL) */}
          <div className="card">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">Par categorie</h4>
            <div className="flex flex-wrap gap-2">
              {statsData.byCategory.map((c) => {
                const cfg = CATEGORY_CONFIG[c.category] ?? { label: c.category, color: "bg-surface-50 text-surface-600 border-surface-200" };
                return (
                  <button
                    key={c.category}
                    onClick={() => updateFilter("status", "")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:shadow-sm ${cfg.color}`}
                  >
                    {cfg.label} <span className="ml-1 font-bold">{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* By Source Type (MC) */}
          <div className="card">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">Par type de contact</h4>
            <div className="flex flex-wrap gap-2">
              {statsData.bySourceType.map((s) => {
                const cfg = SOURCE_TYPE_CONFIG[s.type] ?? { label: s.type, emoji: "📋", color: "bg-surface-100 text-surface-600 border-surface-200" };
                return (
                  <div key={s.type} className={`rounded-lg border px-3 py-2 text-sm ${cfg.color}`}>
                    <span className="mr-1">{cfg.emoji}</span>
                    {cfg.label} <span className="ml-1 font-bold">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Languages + Countries */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">
                <Globe size={14} className="inline mr-1" />Top langues
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {statsData.byLanguage.slice(0, 12).map((l) => (
                  <span key={l.language} className="rounded bg-surface-100 px-2 py-1 text-xs text-surface-600">
                    {(l.language ?? "?").toUpperCase()} <strong>{l.count}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="card">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">
                <Globe size={14} className="inline mr-1" />Top pays
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {statsData.byCountry.slice(0, 12).map((c) => (
                  <span key={c.country} className="rounded bg-surface-100 px-2 py-1 text-xs text-surface-600">
                    {c.country ? getCountryFlag(c.country) : "?"} {c.country ?? "?"} <strong>{c.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <input
              type="text"
              placeholder={t("prospects.searchByDomain")}
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="input-field pl-9"
            />
          </div>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="input-field"
          >
            <option value="">{t("prospects.allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Country */}
          <input
            type="text"
            placeholder={t("prospects.countryPlaceholder")}
            value={filters.country}
            onChange={(e) => updateFilter("country", e.target.value)}
            className="input-field"
          />

          {/* Language */}
          <input
            type="text"
            placeholder={t("prospects.languagePlaceholder")}
            value={filters.language}
            onChange={(e) => updateFilter("language", e.target.value)}
            className="input-field"
          />

          {/* Tier */}
          <select
            value={filters.tier}
            onChange={(e) => updateFilter("tier", e.target.value)}
            className="input-field"
          >
            <option value="">{t("prospects.allTiers")}</option>
            <option value="1">{t("prospects.tier")} 1</option>
            <option value="2">{t("prospects.tier")} 2</option>
            <option value="3">{t("prospects.tier")} 3</option>
          </select>

          {/* Source */}
          <select
            value={filters.source}
            onChange={(e) => updateFilter("source", e.target.value)}
            className="input-field"
          >
            <option value="">{t("prospects.allSources")}</option>
            <option value="manual">{t("prospects.manual")}</option>
            <option value="csv_import">{t("prospects.csvImport")}</option>
            <option value="scraper">{t("prospects.scraper")}</option>
          </select>

          {/* Tag filter */}
          <select
            value={filters.tagId}
            onChange={(e) => updateFilter("tagId", e.target.value)}
            className="input-field"
          >
            <option value="">🏷️ Tous les tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>

          {/* Score range */}
          <input
            type="number"
            placeholder={t("prospects.minScore")}
            value={filters.scoreMin}
            onChange={(e) => updateFilter("scoreMin", e.target.value)}
            className="input-field"
            min={0}
            max={100}
          />
          <input
            type="number"
            placeholder={t("prospects.maxScore")}
            value={filters.scoreMax}
            onChange={(e) => updateFilter("scoreMax", e.target.value)}
            className="input-field"
            min={0}
            max={100}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.domain")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.status")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.score")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">{t("prospects.da")}</th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.country")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.language")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.tier")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.source")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  🏷️ Tags
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("prospects.contacted")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !data?.data.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    {t("prospects.noProspectsFound")}
                  </td>
                </tr>
              ) : (
                data.data.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/prospects/${p.id}`)}
                    className="cursor-pointer transition-colors hover:bg-surface-50"
                  >
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {p.domain}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${STATUS_COLORS[p.status] ?? "bg-surface-100 text-surface-700"}`}
                      >
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.score}</td>
                    <td className="px-4 py-3">{p.mozDa ?? "-"}</td>
                    <td className="px-4 py-3">{p.country ?? "-"}</td>
                    <td className="px-4 py-3">{p.language ?? "-"}</td>
                    <td className="px-4 py-3">
                      {p.tier ? `T${p.tier}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.tags && p.tags.length > 0 ? (
                          p.tags.slice(0, 3).map((pt) => (
                            <span
                              key={pt.tagId}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: pt.tag.color }}
                              title={pt.tag.description || pt.tag.label}
                            >
                              {pt.tag.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-surface-400">-</span>
                        )}
                        {p.tags && p.tags.length > 3 && (
                          <span className="text-xs text-surface-500">
                            +{p.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {p.lastContactedAt
                        ? format(new Date(p.lastContactedAt), "dd MMM yyyy")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3">
            <p className="text-sm text-surface-500">
              {t("common.page")} {data.page} {t("common.of")} {data.totalPages} ({data.total} {t("common.total")})
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="btn-secondary"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
