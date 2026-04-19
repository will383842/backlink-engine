import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  FileText,
  Globe,
  PenLine,
  Upload as UploadIcon,
  Bug as SpiderIcon,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import type { Prospect, PaginatedResponse, Tag } from "@/types";
import { useTranslation } from "@/i18n";
import {
  LANGUAGE_NAMES as LANG_NAMES,
  PROSPECT_STATUS_LABELS as STATUS_LABELS,
  PROSPECT_STATUS_OPTIONS as STATUS_OPTIONS,
  PROSPECT_STATUS_COLORS as STATUS_COLORS,
} from "@/lib/labels";

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
  education: { label: "Education", color: "bg-blue-50 text-blue-700 border-blue-200" },
  agency: { label: "Agences", color: "bg-violet-50 text-violet-700 border-violet-200" },
  ecommerce: { label: "E-commerce", color: "bg-orange-50 text-orange-700 border-orange-200" },
  podcast: { label: "Podcasts", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  forum: { label: "Forums", color: "bg-lime-50 text-lime-700 border-lime-200" },
  directory: { label: "Annuaires", color: "bg-slate-50 text-slate-700 border-slate-200" },
  other: { label: "Autres", color: "bg-surface-50 text-surface-600 border-surface-200" },
};

function getCountryFlag(code: string): string {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch { return code; }
}

const COUNTRY_NAMES: Record<string, string> = {
  FR: "France", US: "Etats-Unis", DE: "Allemagne", ES: "Espagne", IT: "Italie",
  PT: "Portugal", NL: "Pays-Bas", BE: "Belgique", CH: "Suisse", GB: "Royaume-Uni",
  CA: "Canada", BR: "Bresil", MX: "Mexique", AR: "Argentine", CL: "Chili",
  CO: "Colombie", PE: "Perou", JP: "Japon", KR: "Coree du Sud", CN: "Chine",
  TH: "Thailande", VN: "Vietnam", IN: "Inde", AU: "Australie", NZ: "Nlle-Zelande",
  MA: "Maroc", TN: "Tunisie", SN: "Senegal", CI: "Cote d'Ivoire", CM: "Cameroun",
  AE: "Emirats", SA: "Arabie S.", IL: "Israel", TR: "Turquie", RU: "Russie",
  PL: "Pologne", CZ: "Tchequie", RO: "Roumanie", HU: "Hongrie", GR: "Grece",
  SE: "Suede", NO: "Norvege", DK: "Danemark", FI: "Finlande", IE: "Irlande",
  AT: "Autriche", LU: "Luxembourg", SK: "Slovaquie", SI: "Slovenie", HR: "Croatie",
  PH: "Philippines", SG: "Singapour", MY: "Malaisie", ID: "Indonesie",
  VE: "Venezuela", EC: "Equateur", UY: "Uruguay", PY: "Paraguay",
  MU: "Maurice", RE: "Reunion", NC: "Nlle-Caledonie", PF: "Polynesie Fr.",
};

interface Filters {
  status: string;
  country: string;
  language: string;
  tier: string;
  source: string;
  sourceContactType: string;
  scoreMin: string;
  scoreMax: string;
  search: string;
  tagId: string;
}

// Source badge config — used in the main table to visually distinguish origins
const SOURCE_BADGE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  manual: {
    label: "Manuel",
    icon: <PenLine size={10} />,
    color: "bg-brand-50 text-brand-700 border-brand-200",
  },
  csv_import: {
    label: "CSV / MC",
    icon: <UploadIcon size={10} />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  scraper: {
    label: "Scraper",
    icon: <SpiderIcon size={10} />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

type SortKey = "createdAt" | "score" | "domain" | "lastContactedAt";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt:desc", label: "Plus récents d'abord" },
  { value: "createdAt:asc", label: "Plus anciens d'abord" },
  { value: "score:desc", label: "Meilleur score d'abord" },
  { value: "score:asc", label: "Pire score d'abord" },
  { value: "domain:asc", label: "Domaine A→Z" },
  { value: "domain:desc", label: "Domaine Z→A" },
  { value: "lastContactedAt:desc", label: "Dernier contact récent" },
];

export default function Prospects() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  // Sort state — persisted in URL ?sort=score:desc
  const initialSortRaw = searchParams.get("sort") || "createdAt:desc";
  const [sortBy, setSortBy] = useState<string>(initialSortRaw);
  const [sortField, sortDir] = sortBy.split(":") as [SortKey, SortDir];

  // Contactable-only filter — default true (unreachable prospects hidden unless opted in)
  const [contactableOnly, setContactableOnly] = useState<boolean>(
    searchParams.get("contactable") !== "false"
  );

  const [filters, setFilters] = useState<Filters>({
    status: "",
    country: "",
    language: "",
    tier: "",
    source: "",
    sourceContactType: "",
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
        contactable?: number;
        unreachable?: number;
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

  // Sync sort + contactable to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (sortBy && sortBy !== "createdAt:desc") {
      params.set("sort", sortBy);
    } else {
      params.delete("sort");
    }
    if (!contactableOnly) {
      params.set("contactable", "false");
    } else {
      params.delete("contactable");
    }
    setSearchParams(params, { replace: true });
  }, [sortBy, contactableOnly]);

  const { data, isLoading } = useQuery<PaginatedResponse<Prospect>>({
    queryKey: [
      "prospects",
      page,
      sortBy,
      contactableOnly,
      { ...filters, search: debouncedSearch },
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (filters.status) params.status = filters.status;
      if (filters.country) params.country = filters.country;
      if (filters.language) params.language = filters.language;
      if (filters.tier) params.tier = filters.tier;
      if (filters.source) params.source = filters.source;
      if (filters.sourceContactType) params.sourceContactType = filters.sourceContactType;
      if (filters.scoreMin) params.scoreMin = filters.scoreMin;
      if (filters.scoreMax) params.scoreMax = filters.scoreMax;
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.tagId) params.tagId = filters.tagId;
      if (sortField) params.sortBy = sortField;
      if (sortDir) params.sortDir = sortDir;
      params.contactable = contactableOnly ? "true" : "all";
      const res = await api.get("/prospects", { params });
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {statsData && (
        <div className="space-y-4">
          {/* Top row: Total / Contactables / Unreachable */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Users size={16} /> Total base
              </div>
              <p className="mt-1 text-2xl font-bold text-surface-900">
                {statsData.total.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 size={16} /> Contactables
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {(statsData.contactable ?? 0).toLocaleString()}
                <span className="ml-2 text-sm font-normal text-emerald-600">
                  (
                  {statsData.total > 0
                    ? Math.round(((statsData.contactable ?? 0) / statsData.total) * 100)
                    : 0}
                  %)
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <XCircle size={16} /> Unreachable
              </div>
              <p className="mt-1 text-2xl font-bold text-red-700">
                {(statsData.unreachable ?? 0).toLocaleString()}
                <span className="ml-2 text-sm font-normal text-red-600">
                  (
                  {statsData.total > 0
                    ? Math.round(((statsData.unreachable ?? 0) / statsData.total) * 100)
                    : 0}
                  %)
                </span>
              </p>
            </div>
          </div>

          {/* Contact method breakdown (detail row) */}
          <div className="grid gap-3 sm:grid-cols-4">
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

          {/* By Category (BL) — clickable */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Par categorie</h4>
              {filters.status === "CATEGORY_FILTER" && (
                <button onClick={() => { updateFilter("status", ""); }} className="text-xs text-brand-600 hover:underline">
                  Voir tous
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {statsData.byCategory.map((c) => {
                const cfg = CATEGORY_CONFIG[c.category] ?? { label: c.category, color: "bg-surface-50 text-surface-600 border-surface-200" };
                // Category filter uses the category query param, not status
                const catParam = "category";
                const isActive = new URLSearchParams(window.location.search).get(catParam) === c.category;
                return (
                  <button
                    key={c.category}
                    onClick={() => {
                      // Use URL params to set category filter
                      const params = new URLSearchParams(window.location.search);
                      if (isActive) {
                        params.delete(catParam);
                      } else {
                        params.set(catParam, c.category);
                      }
                      navigate(`/prospects?${params.toString()}`);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all cursor-pointer hover:shadow-sm ${cfg.color}`}
                  >
                    {cfg.label} <span className="ml-1 font-bold">{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* By Source Type (MC) — clickable */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Par type de contact</h4>
              {filters.sourceContactType && (
                <button onClick={() => updateFilter("sourceContactType", "")} className="text-xs text-brand-600 hover:underline">
                  Voir tous
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {statsData.bySourceType.map((s) => {
                const cfg = SOURCE_TYPE_CONFIG[s.type] ?? { label: s.type, emoji: "📋", color: "bg-surface-100 text-surface-600 border-surface-200" };
                const isActive = filters.sourceContactType === s.type;
                return (
                  <button
                    key={s.type}
                    onClick={() => updateFilter("sourceContactType", isActive ? "" : s.type)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all cursor-pointer ${
                      isActive
                        ? "ring-2 ring-brand-500 shadow-md scale-105 " + cfg.color
                        : "hover:shadow-sm " + cfg.color
                    }`}
                  >
                    <span className="mr-1">{cfg.emoji}</span>
                    {cfg.label} <span className="ml-1 font-bold">{s.count}</span>
                  </button>
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
      <div className="card space-y-3">
        {/* Contactable toggle — prominent at the top */}
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            contactableOnly
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-surface-300 bg-white text-surface-600 hover:bg-surface-50"
          }`}
        >
          <input
            type="checkbox"
            checked={contactableOnly}
            onChange={(e) => {
              setContactableOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
          />
          {contactableOnly ? (
            <>
              <CheckCircle2 size={16} /> Contactables uniquement (recommandé)
            </>
          ) : (
            <>
              <XCircle size={16} /> Afficher TOUS les prospects (y compris unreachable)
            </>
          )}
        </label>

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

          {/* Sort selector */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <ArrowUpDown
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="input-field pl-9"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3 font-medium text-surface-600">Site</th>
                <th className="px-4 py-3 font-medium text-surface-600">Type</th>
                <th className="px-4 py-3 font-medium text-surface-600">Statut</th>
                <th className="px-4 py-3 font-medium text-surface-600">Contact</th>
                <th className="px-4 py-3 font-medium text-surface-600">Origine</th>
                <th className="px-4 py-3 font-medium text-surface-600">Pays</th>
                <th className="px-4 py-3 font-medium text-surface-600">Langue</th>
                <th className="px-4 py-3 font-medium text-surface-600 text-center">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-surface-500">
                    {t("prospects.noProspectsFound")}
                  </td>
                </tr>
              ) : (
                data.data.map((p) => {
                  const contact = p.contacts?.[0] as any;
                  const sct = contact?.sourceContactType ?? (p as any).sourceContactType;
                  const sctCfg = sct ? SOURCE_TYPE_CONFIG[sct] : null;
                  const sourceCfg = SOURCE_BADGE_CONFIG[(p as any).source] ?? null;

                  return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/prospects/${p.id}`)}
                    className="cursor-pointer transition-colors hover:bg-surface-50 group"
                  >
                    {/* Site (domain + link) */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-surface-900">{p.domain}</div>
                      {p.contacts && p.contacts.length > 0 && p.contacts[0].name && (
                        <div className="text-xs text-surface-400 mt-0.5">{contact?.firstName ?? contact?.name}</div>
                      )}
                    </td>

                    {/* Type (MC source type) */}
                    <td className="px-4 py-3">
                      {sctCfg ? (
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${sctCfg.color}`}>
                          {sctCfg.emoji} {sctCfg.label}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">{(CATEGORY_CONFIG[p.category] ?? { label: p.category }).label}</span>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${STATUS_COLORS[p.status] ?? "bg-surface-100 text-surface-700"}`}>
                        {STATUS_LABELS[p.status] ?? p.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Contact (email + form) */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {contact?.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className={contact.emailStatus === "verified" ? "text-emerald-500" : contact.emailStatus === "invalid" ? "text-red-400" : "text-surface-400"} />
                            <span className="text-xs text-surface-600 truncate max-w-[180px]">{contact.email}</span>
                          </div>
                        )}
                        {p.contactFormUrl && (
                          <div className="flex items-center gap-1.5">
                            <FileText size={12} className="text-blue-500" />
                            <span className="text-xs text-blue-600 truncate max-w-[180px]">Formulaire</span>
                          </div>
                        )}
                        {!contact?.email && !p.contactFormUrl && (
                          <span className="text-xs text-surface-300">Aucun</span>
                        )}
                      </div>
                    </td>

                    {/* Origine (source) */}
                    <td className="px-4 py-3">
                      {sourceCfg ? (
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${sourceCfg.color}`}>
                          {sourceCfg.icon}
                          {sourceCfg.label}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-300">—</span>
                      )}
                    </td>

                    {/* Pays */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.country ? (
                        <span className="text-xs text-surface-600">
                          {getCountryFlag(p.country)} {COUNTRY_NAMES[p.country] ?? p.country}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-300">-</span>
                      )}
                    </td>

                    {/* Langue */}
                    <td className="px-4 py-3">
                      {p.language ? (
                        <span className="text-xs text-surface-600">{LANG_NAMES[p.language] ?? p.language}</span>
                      ) : (
                        <span className="text-xs text-surface-300">-</span>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        p.score >= 7 ? "bg-emerald-100 text-emerald-700" :
                        p.score >= 4 ? "bg-amber-100 text-amber-700" :
                        "bg-surface-100 text-surface-500"
                      }`}>
                        {p.score}
                      </span>
                    </td>
                  </tr>
                  );
                })
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
