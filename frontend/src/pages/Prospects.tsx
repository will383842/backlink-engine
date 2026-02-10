import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api";
import type { Prospect, ProspectStatus, PaginatedResponse } from "@/types";

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
}

export default function Prospects() {
  const navigate = useNavigate();
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
      const res = await api.get("/prospects", { params });
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
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
              placeholder="Search by domain..."
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
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Country */}
          <input
            type="text"
            placeholder="Country (e.g. FR)"
            value={filters.country}
            onChange={(e) => updateFilter("country", e.target.value)}
            className="input-field"
          />

          {/* Language */}
          <input
            type="text"
            placeholder="Language (e.g. fr)"
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
            <option value="">All Tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>

          {/* Source */}
          <select
            value={filters.source}
            onChange={(e) => updateFilter("source", e.target.value)}
            className="input-field"
          >
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="csv_import">CSV Import</option>
            <option value="scraper">Scraper</option>
          </select>

          {/* Score range */}
          <input
            type="number"
            placeholder="Min Score"
            value={filters.scoreMin}
            onChange={(e) => updateFilter("scoreMin", e.target.value)}
            className="input-field"
            min={0}
            max={100}
          />
          <input
            type="number"
            placeholder="Max Score"
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
                  Domain
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Score
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">DA</th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Country
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Language
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Tier
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Source
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Contacted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !data?.data.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    No prospects found.
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
              Page {data.page} of {data.totalPages} ({data.total} total)
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
