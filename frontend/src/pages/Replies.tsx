import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Eye, Globe, Mail } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Reply, ReplyCategory } from "@/types";
import { useTranslation } from "@/i18n";

const CATEGORY_LABELS: Record<string, string> = {
  blogger: "Blogueur",
  influencer: "Influenceur",
  media: "Presse",
  partner: "Partenaire",
  other: "Autre",
  association: "Association",
  agency: "Agence",
  corporate: "Entreprise",
  ecommerce: "E-commerce",
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  blogger: "bg-indigo-100 text-indigo-700",
  influencer: "bg-pink-100 text-pink-700",
  media: "bg-cyan-100 text-cyan-700",
  partner: "bg-teal-100 text-teal-700",
  other: "bg-surface-100 text-surface-600",
};

function getCountryFlag(code: string): string {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch { return code; }
}

const CATEGORY_COLORS: Record<string, string> = {
  INTERESTED: "bg-emerald-100 text-emerald-700",
  NOT_INTERESTED: "bg-red-100 text-red-700",
  ASKING_PRICE: "bg-amber-100 text-amber-700",
  ASKING_QUESTIONS: "bg-blue-100 text-blue-700",
  ALREADY_LINKED: "bg-purple-100 text-purple-700",
  OUT_OF_OFFICE: "bg-blue-100 text-blue-700",
  BOUNCE: "bg-orange-100 text-orange-700",
  UNSUBSCRIBE: "bg-surface-800 text-white",
  SPAM: "bg-red-200 text-red-800",
  OTHER: "bg-surface-100 text-surface-600",
};

const CATEGORY_OPTIONS: ReplyCategory[] = [
  "INTERESTED",
  "NOT_INTERESTED",
  "ASKING_PRICE",
  "ASKING_QUESTIONS",
  "ALREADY_LINKED",
  "OUT_OF_OFFICE",
  "BOUNCE",
  "UNSUBSCRIBE",
  "SPAM",
  "OTHER",
];

export default function Replies() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: replies, isLoading } = useQuery<Reply[]>({
    queryKey: ["replies", filterCategory],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterCategory) params.category = filterCategory;
      const res = await api.get("/replies", { params });
      return res.data?.data ?? res.data;
    },
  });

  const handleMutation = useMutation({
    mutationFn: async (replyId: number) => {
      const res = await api.post(`/replies/${replyId}/handle`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(t("replies.replyMarkedHandled"));
      queryClient.invalidateQueries({ queryKey: ["replies"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card flex items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">{t("replies.allCategories")}</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <div className="flex-1" />
        <p className="text-sm text-surface-500">
          {replies?.filter((r) => !r.isHandled).length ?? 0} {t("replies.unhandled")}
        </p>
      </div>

      {/* Reply list */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : !replies?.length ? (
        <div className="card text-center text-surface-500">
          {t("replies.noRepliesFound")}
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map((r) => (
            <div
              key={r.id}
              className={`card transition-all ${
                r.isHandled ? "opacity-60" : ""
              }`}
            >
              {/* Reply header row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-surface-900">
                  {r.prospectDomain}
                </span>
                {r.prospectCategory && (
                  <span className={`badge text-[10px] ${CATEGORY_BADGE_COLORS[r.prospectCategory] ?? "bg-surface-100 text-surface-600"}`}>
                    {CATEGORY_LABELS[r.prospectCategory] ?? r.prospectCategory}
                  </span>
                )}
                {r.prospectCountry && (
                  <span className="text-xs" title={r.prospectCountry}>{getCountryFlag(r.prospectCountry)}</span>
                )}
                {r.prospectLanguage && (
                  <span className="text-[10px] text-surface-400 uppercase">{r.prospectLanguage}</span>
                )}
                <span className="text-surface-300">|</span>
                <span className={`badge ${CATEGORY_COLORS[r.category]}`}>
                  {r.category.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-surface-500">
                  {r.confidence}%
                </span>
                <div className="flex-1" />
                <time className="text-xs text-surface-400">
                  {format(new Date(r.receivedAt), "dd MMM yyyy HH:mm")}
                </time>
              </div>

              {/* Contact + campaign info */}
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-surface-500">
                {r.contact?.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-surface-400" />
                    {r.contact.email}
                  </span>
                )}
                {r.campaignName && (
                  <span className="flex items-center gap-1">
                    <Globe size={12} className="text-surface-400" />
                    {r.campaignName}
                  </span>
                )}
              </div>

              {/* Summary */}
              <p className="mt-2 text-sm text-surface-600">{r.summary}</p>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === r.id ? null : r.id)
                  }
                  className="btn-secondary text-xs"
                >
                  <Eye size={14} className="mr-1" />
                  {expandedId === r.id ? t("replies.collapse") : t("replies.viewFull")}
                </button>
                {!r.isHandled && (
                  <button
                    onClick={() => handleMutation.mutate(r.id)}
                    disabled={handleMutation.isPending}
                    className="btn-secondary text-xs"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    {t("replies.markHandled")}
                  </button>
                )}
              </div>

              {/* Expanded content */}
              {expandedId === r.id && (
                <div className="mt-4 space-y-3 border-t border-surface-200 pt-4">
                  <div>
                    <h5 className="mb-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                      {t("replies.fullReply")}
                    </h5>
                    <div className="whitespace-pre-wrap rounded-lg bg-surface-50 p-3 text-sm text-surface-700">
                      {r.fullText}
                    </div>
                  </div>
                  {r.suggestedAction && (
                    <div>
                      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                        {t("replies.suggestedAction")}
                      </h5>
                      <p className="text-sm text-brand-700">
                        {r.suggestedAction}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
