import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Mail, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Campaign } from "@/types";
import { useTranslation } from "@/i18n";
import { LANGUAGE_OPTIONS } from "@/lib/languageOptions";

export default function Campaigns() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("fr");
  const [targetTier, setTargetTier] = useState("");
  const [targetCountry, setTargetCountry] = useState("");

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await api.get("/campaigns");
      return res.data?.data ?? res.data;
    },
  });

  const { data: enrollments } = useQuery<
    { id: string; prospectDomain: string; status: string; enrolledAt: string }[]
  >({
    queryKey: ["campaign-enrollments", selectedId],
    queryFn: async () => {
      const res = await api.get(`/campaigns/${selectedId}/enrollments`);
      return res.data?.data ?? res.data;
    },
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/campaigns", {
        name,
        language,
        targetTier: targetTier ? parseInt(targetTier) : null,
        targetCountry: targetCountry || null,
        sequenceConfig: {},
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t("campaigns.campaignCreated"));
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      resetForm();
    },
  });

  function resetForm() {
    setShowForm(false);
    setName("");
    setLanguage("fr");
    setTargetTier("");
    setTargetCountry("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("campaigns.nameRequired"));
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          {campaigns?.length ?? 0} {t("campaigns.title")}
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-1.5" />
          {t("campaigns.newCampaign")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h4 className="font-semibold text-surface-900">{t("campaigns.createCampaign")}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("campaigns.name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Q1 French Outreach"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("campaigns.campaignLanguage")}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input-field"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {t(l.labelKey as never)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("campaigns.targetTier")}
              </label>
              <select
                value={targetTier}
                onChange={(e) => setTargetTier(e.target.value)}
                className="input-field"
              >
                <option value="">{t("campaigns.any")}</option>
                <option value="1">{t("prospects.tier")} 1</option>
                <option value="2">{t("prospects.tier")} 2</option>
                <option value="3">{t("prospects.tier")} 3</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("campaigns.targetCountry")}
              </label>
              <input
                type="text"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                className="input-field"
                placeholder="FR, DE, ES..."
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-surface-400">
                {t("campaigns.listAutoResolved")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? t("common.creating") : t("common.create")}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Campaign list */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : !campaigns?.length ? (
        <div className="card text-center text-surface-500">
          {t("campaigns.noCampaignsYet")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
              className={`card cursor-pointer transition-shadow hover:shadow-md ${
                selectedId === c.id ? "ring-2 ring-brand-500" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-surface-900">{c.name}</h4>
                <span
                  className={`badge ${
                    c.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-surface-100 text-surface-500"
                  }`}
                >
                  {c.isActive ? t("common.active") : t("common.inactive")}
                </span>
              </div>
              <p className="mb-3 text-xs text-surface-500">
                {c.language.toUpperCase()}
                {c.targetTier ? ` / T${c.targetTier}` : ""}
                {c.targetCountry ? ` / ${c.targetCountry}` : ""}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <Users size={14} className="mx-auto text-surface-400" />
                  <p className="mt-1 text-lg font-bold text-surface-900">
                    {c.totalEnrolled}
                  </p>
                  <p className="text-xs text-surface-500">{t("campaigns.enrolled")}</p>
                </div>
                <div>
                  <Mail size={14} className="mx-auto text-surface-400" />
                  <p className="mt-1 text-lg font-bold text-surface-900">
                    {c.totalReplied}
                  </p>
                  <p className="text-xs text-surface-500">{t("campaigns.replied")}</p>
                </div>
                <div>
                  <Trophy size={14} className="mx-auto text-surface-400" />
                  <p className="mt-1 text-lg font-bold text-emerald-600">
                    {c.totalWon}
                  </p>
                  <p className="text-xs text-surface-500">{t("campaigns.won")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enrollments detail */}
      {selectedId && enrollments && (
        <div className="card">
          <h4 className="mb-4 font-semibold text-surface-900">{t("campaigns.enrollments")}</h4>
          {!enrollments.length ? (
            <p className="text-sm text-surface-400">{t("campaigns.noEnrollmentsYet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-surface-200">
                  <tr>
                    <th className="pb-2 font-medium text-surface-500">
                      {t("prospects.domain")}
                    </th>
                    <th className="pb-2 font-medium text-surface-500">
                      {t("prospects.status")}
                    </th>
                    <th className="pb-2 font-medium text-surface-500">
                      {t("campaigns.enrolledAt")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {enrollments.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 font-medium text-surface-900">
                        {e.prospectDomain}
                      </td>
                      <td className="py-2">
                        <span className="badge bg-brand-50 text-brand-700">
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-surface-500">
                        {e.enrolledAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
