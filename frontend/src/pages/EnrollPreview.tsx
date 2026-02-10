import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Send, Tag } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Campaign } from "@/types";
import { useTranslation } from "@/i18n";

interface EnrollPreviewData {
  subject: string;
  body: string;
  tags: string[];
  campaign: {
    id: string;
    name: string;
    language: string;
  };
}

interface EnrollPreviewProps {
  prospectId: string;
  prospectDomain: string;
  onClose: () => void;
}

export default function EnrollPreview({
  prospectId,
  prospectDomain,
  onClose,
}: EnrollPreviewProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  // Close modal on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await api.get("/campaigns");
      return res.data?.data ?? res.data;
    },
  });

  const { data: preview, isLoading: previewLoading } =
    useQuery<EnrollPreviewData>({
      queryKey: ["enroll-preview", prospectId, selectedCampaignId],
      queryFn: async () => {
        const res = await api.get(
          `/prospects/${prospectId}/enroll-preview?campaignId=${selectedCampaignId}`
        );
        return res.data?.data ?? res.data;
      },
      enabled: !!selectedCampaignId,
    });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${prospectId}/enroll`, {
        campaignId: selectedCampaignId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t("enrollPreview.enrolledInCampaign", { domain: prospectDomain }));
      queryClient.invalidateQueries({ queryKey: ["prospect", prospectId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-surface-900">
              {t("enrollPreview.title")}
            </h3>
            <p className="text-sm text-surface-500">{prospectDomain}</p>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
          {/* Campaign selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("enrollPreview.selectCampaign")}
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="input-field"
            >
              <option value="">{t("enrollPreview.chooseCampaign")}</option>
              {campaigns
                ?.filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.language.toUpperCase()})
                  </option>
                ))}
            </select>
          </div>

          {/* Preview loading */}
          {previewLoading && selectedCampaignId && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          )}

          {/* Preview content */}
          {preview && (
            <>
              {/* Campaign info */}
              <div className="rounded-lg bg-surface-50 p-4">
                <h4 className="mb-1 text-sm font-semibold text-surface-700">
                  {t("enrollPreview.campaign")}
                </h4>
                <p className="text-sm text-surface-900">
                  {preview.campaign.name} ({preview.campaign.language.toUpperCase()})
                </p>
              </div>

              {/* Tags */}
              {preview.tags.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-surface-700">
                    <Tag size={14} /> {t("enrollPreview.tagsToApply")}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {preview.tags.map((tag) => (
                      <span
                        key={tag}
                        className="badge bg-brand-50 text-brand-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Email preview */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-surface-700">
                  {t("enrollPreview.emailPreview")}
                </h4>
                <div className="rounded-lg border border-surface-200 bg-white">
                  <div className="border-b border-surface-100 px-4 py-2">
                    <p className="text-sm">
                      <span className="font-medium text-surface-500">
                        {t("enrollPreview.subjectLabel")}{" "}
                      </span>
                      <span className="text-surface-900">
                        {preview.subject}
                      </span>
                    </p>
                  </div>
                  <div className="whitespace-pre-wrap px-4 py-3 text-sm text-surface-700">
                    {preview.body}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-200 px-6 py-4">
          <button onClick={onClose} className="btn-secondary">
            {t("common.cancel")}
          </button>
          <button
            onClick={() => enrollMutation.mutate()}
            disabled={
              !selectedCampaignId ||
              enrollMutation.isPending ||
              previewLoading
            }
            className="btn-primary"
          >
            <Send size={16} className="mr-1.5" />
            {enrollMutation.isPending ? t("enrollPreview.enrolling") : t("enrollPreview.confirmAndEnroll")}
          </button>
        </div>
      </div>
    </div>
  );
}
