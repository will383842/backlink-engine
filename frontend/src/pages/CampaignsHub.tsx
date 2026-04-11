import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Users,
  Send,
  Reply as ReplyIcon,
  Target,
  Radio,
  X,
  AlertCircle,
  Calendar,
  Globe,
} from "lucide-react";
import api from "@/lib/api";
import type { Campaign } from "@/types";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BroadcastCampaignLite {
  id: number;
  name: string;
  language: string;
  campaignType: string;
  totalEnrolled: number;
  totalSent: number;
  totalReplied?: number;
  totalOpened: number;
  totalBounced: number;
  isActive: boolean;
  createdAt: string;
  currentWarmupDay?: number;
}

type UnifiedCampaign = (Campaign | BroadcastCampaignLite) & {
  _type: "outreach" | "broadcast";
};

type TabFilter = "all" | "outreach" | "broadcast";
type SortKey = "newest" | "enrollments" | "sent";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignsHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query state — init from URL param for /broadcast redirect compat
  const initialType = (searchParams.get("type") as TabFilter) || "all";
  const [tab, setTab] = useState<TabFilter>(initialType);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showNewModal, setShowNewModal] = useState(false);

  // Sync tab → URL
  useEffect(() => {
    if (tab === "all") {
      searchParams.delete("type");
    } else {
      searchParams.set("type", tab);
    }
    setSearchParams(searchParams, { replace: true });
  }, [tab]);

  // --- Data fetching: outreach + broadcast in parallel ---
  const outreachQuery = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await api.get("/campaigns");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const broadcastQuery = useQuery<BroadcastCampaignLite[]>({
    queryKey: ["broadcast-campaigns"],
    queryFn: async () => {
      const res = await api.get("/broadcast");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const isLoading = outreachQuery.isLoading || broadcastQuery.isLoading;
  const hasError = outreachQuery.isError || broadcastQuery.isError;

  // --- Merge campaigns with discriminator ---
  const unifiedCampaigns = useMemo<UnifiedCampaign[]>(() => {
    const outreach: UnifiedCampaign[] = (outreachQuery.data ?? []).map((c) => ({
      ...c,
      _type: "outreach" as const,
    }));
    const broadcast: UnifiedCampaign[] = (broadcastQuery.data ?? []).map((c) => ({
      ...c,
      _type: "broadcast" as const,
    }));
    return [...outreach, ...broadcast];
  }, [outreachQuery.data, broadcastQuery.data]);

  // --- Filter + sort ---
  const filteredCampaigns = useMemo(() => {
    let list = unifiedCampaigns;

    // Tab filter
    if (tab !== "all") {
      list = list.filter((c) => c._type === tab);
    }

    // Active toggle
    if (activeOnly) {
      list = list.filter((c) => c.isActive);
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "enrollments") {
        return (b.totalEnrolled ?? 0) - (a.totalEnrolled ?? 0);
      }
      if (sortBy === "sent") {
        const aSent = (a as BroadcastCampaignLite).totalSent ?? 0;
        const bSent = (b as BroadcastCampaignLite).totalSent ?? 0;
        return bSent - aSent;
      }
      return 0;
    });

    return list;
  }, [unifiedCampaigns, tab, activeOnly, search, sortBy]);

  // --- Counts for tab badges ---
  const counts = useMemo(() => {
    const out = unifiedCampaigns.filter((c) => c._type === "outreach");
    const bro = unifiedCampaigns.filter((c) => c._type === "broadcast");
    return {
      all: unifiedCampaigns.length,
      outreach: out.length,
      broadcast: bro.length,
    };
  }, [unifiedCampaigns]);

  // --- Navigation ---
  function openCampaign(c: UnifiedCampaign) {
    if (c._type === "outreach") {
      navigate("/campaigns/outreach");
    } else {
      navigate("/campaigns/broadcast");
    }
  }

  function handleNewCampaign(type: "outreach" | "broadcast") {
    setShowNewModal(false);
    if (type === "outreach") {
      navigate("/campaigns/outreach");
    } else {
      navigate("/campaigns/broadcast");
    }
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Header                                                         */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">
            {t("campaigns.hub.title")}
          </h2>
          <p className="mt-1 text-sm text-surface-500">
            {filteredCampaigns.length} / {counts.all}{" "}
            {counts.all > 1
              ? t("campaigns.hub.campaigns")
              : t("campaigns.hub.campaign")}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary inline-flex items-center"
        >
          <Plus size={18} className="mr-1.5" />
          {t("campaigns.hub.newCampaign")}
        </button>
      </div>

      {/* ============================================================ */}
      {/* Tabs + Filters                                                 */}
      {/* ============================================================ */}
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-surface-200 bg-surface-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-white sm:px-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-surface-100 pb-2 sm:border-b-0 sm:pb-0">
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            label={t("campaigns.hub.tabs.all")}
            count={counts.all}
          />
          <TabButton
            active={tab === "outreach"}
            onClick={() => setTab("outreach")}
            label={t("campaigns.hub.tabs.outreach")}
            count={counts.outreach}
            icon={<Target size={14} />}
          />
          <TabButton
            active={tab === "broadcast"}
            onClick={() => setTab("broadcast")}
            label={t("campaigns.hub.tabs.broadcast")}
            count={counts.broadcast}
            icon={<Radio size={14} />}
          />
        </div>

        {/* Search + filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("campaigns.hub.search")}
              className="input-field pl-9"
            />
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 hover:bg-surface-50">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            {t("campaigns.hub.activeOnly")}
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="input-field max-w-[180px]"
          >
            <option value="newest">{t("campaigns.hub.sort.newest")}</option>
            <option value="enrollments">
              {t("campaigns.hub.sort.enrollments")}
            </option>
            <option value="sent">{t("campaigns.hub.sort.sent")}</option>
          </select>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Content                                                        */}
      {/* ============================================================ */}
      {isLoading && <SkeletonGrid />}

      {hasError && !isLoading && (
        <div className="card flex items-start gap-3 border-red-200 bg-red-50 text-red-700">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{t("campaigns.hub.errorTitle")}</p>
            <p className="mt-1 text-sm">
              {outreachQuery.isError && "Outreach API failed. "}
              {broadcastQuery.isError && "Broadcast API failed."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !hasError && filteredCampaigns.length === 0 && (
        <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Send size={24} />
          </div>
          <p className="text-surface-600">
            {counts.all === 0
              ? t("campaigns.hub.empty")
              : t("campaigns.hub.noMatch")}
          </p>
          {counts.all === 0 && (
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-primary inline-flex items-center"
            >
              <Plus size={16} className="mr-1.5" />
              {t("campaigns.hub.createFirst")}
            </button>
          )}
        </div>
      )}

      {!isLoading && !hasError && filteredCampaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCampaigns.map((c) => (
            <CampaignCard
              key={`${c._type}-${c.id}`}
              campaign={c}
              onClick={() => openCampaign(c)}
            />
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* New Campaign Modal                                             */}
      {/* ============================================================ */}
      {showNewModal && (
        <NewCampaignModal
          onClose={() => setShowNewModal(false)}
          onChoose={handleNewCampaign}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-surface-600 hover:bg-surface-100"
      }`}
    >
      {icon}
      {label}
      <span
        className={`ml-0.5 rounded-full px-1.5 text-xs ${
          active ? "bg-brand-600 text-white" : "bg-surface-200 text-surface-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: UnifiedCampaign;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isOutreach = campaign._type === "outreach";
  const totalSent =
    (campaign as BroadcastCampaignLite).totalSent ??
    (campaign as Campaign).totalReplied ??
    0;
  const totalReplied = (campaign as Campaign).totalReplied ?? 0;

  return (
    <button
      onClick={onClick}
      className="card group flex flex-col gap-3 text-left transition-all hover:border-brand-300 hover:shadow-md"
    >
      {/* Type + status badges */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`badge inline-flex items-center gap-1 ${
            isOutreach
              ? "bg-blue-100 text-blue-700"
              : "bg-purple-100 text-purple-700"
          }`}
        >
          {isOutreach ? <Target size={12} /> : <Radio size={12} />}
          {isOutreach
            ? t("campaigns.hub.tabs.outreach")
            : t("campaigns.hub.tabs.broadcast")}
        </span>
        <span
          className={`badge ${
            campaign.isActive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-surface-100 text-surface-500"
          }`}
        >
          {campaign.isActive ? t("common.active") : t("common.inactive")}
        </span>
      </div>

      {/* Name */}
      <h4 className="line-clamp-2 min-h-[2.5rem] font-semibold text-surface-900 group-hover:text-brand-700">
        {campaign.name}
      </h4>

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-surface-500">
        <span className="inline-flex items-center gap-1">
          <Globe size={12} />
          {campaign.language.toUpperCase()}
        </span>
        {(campaign as Campaign).targetCountry && (
          <span>{(campaign as Campaign).targetCountry}</span>
        )}
        {(campaign as Campaign).targetTier && (
          <span>T{(campaign as Campaign).targetTier}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          {new Date(campaign.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Stats */}
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-surface-100 pt-3 text-center">
        <Stat icon={<Users size={14} />} value={campaign.totalEnrolled} label={t("campaigns.hub.statEnrolled")} />
        <Stat icon={<Send size={14} />} value={totalSent} label={t("campaigns.hub.statSent")} />
        <Stat
          icon={<ReplyIcon size={14} />}
          value={totalReplied}
          label={t("campaigns.hub.statReplied")}
          accent
        />
      </div>
    </button>
  );
}

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mx-auto text-surface-400">{icon}</div>
      <p
        className={`mt-1 text-base font-bold ${
          accent ? "text-emerald-600" : "text-surface-900"
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-surface-500">
        {label}
      </p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-5 w-20 rounded bg-surface-200" />
            <div className="h-5 w-16 rounded bg-surface-200" />
          </div>
          <div className="h-5 w-3/4 rounded bg-surface-200" />
          <div className="h-3 w-1/2 rounded bg-surface-100" />
          <div className="grid grid-cols-3 gap-2 border-t border-surface-100 pt-3">
            <div className="h-10 rounded bg-surface-100" />
            <div className="h-10 rounded bg-surface-100" />
            <div className="h-10 rounded bg-surface-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewCampaignModal({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (type: "outreach" | "broadcast") => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-surface-900">
              {t("campaigns.hub.chooseType")}
            </h3>
            <p className="mt-1 text-sm text-surface-500">
              {t("campaigns.hub.chooseTypeHint")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <TypeChoiceCard
            icon={<Target size={28} />}
            title={t("campaigns.hub.tabs.outreach")}
            description={t("campaigns.hub.typeOutreachDesc")}
            accent="blue"
            onClick={() => onChoose("outreach")}
          />
          <TypeChoiceCard
            icon={<Radio size={28} />}
            title={t("campaigns.hub.tabs.broadcast")}
            description={t("campaigns.hub.typeBroadcastDesc")}
            accent="purple"
            onClick={() => onChoose("broadcast")}
          />
        </div>
      </div>
    </div>
  );
}

function TypeChoiceCard({
  icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "blue" | "purple";
  onClick: () => void;
}) {
  const colorClasses =
    accent === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100"
      : "border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400 hover:bg-purple-100";

  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${colorClasses}`}
    >
      {icon}
      <h4 className="font-semibold">{title}</h4>
      <p className="text-xs opacity-80">{description}</p>
    </button>
  );
}
