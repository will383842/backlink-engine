import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { SuppressionEntry } from "@/types";
import { useTranslation } from "@/i18n";

export default function Suppression() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const { data: entries, isLoading } = useQuery<SuppressionEntry[]>({
    queryKey: ["suppression"],
    queryFn: async () => {
      const res = await api.get("/suppression");
      return res.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/suppression", {
        email: email.trim(),
        reason: reason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t("suppression.addedToSuppression"));
      queryClient.invalidateQueries({ queryKey: ["suppression"] });
      setEmail("");
      setReason("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/suppression/${id}`);
    },
    onSuccess: () => {
      toast.success(t("suppression.removedFromSuppression"));
      queryClient.invalidateQueries({ queryKey: ["suppression"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !reason.trim()) {
      toast.error(t("suppression.emailAndReasonRequired"));
      return;
    }
    addMutation.mutate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("suppression.title")} ({entries?.length ?? 0})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          <Plus size={16} className="mr-1.5" /> {t("suppression.addEmail")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-surface-900">
              {t("suppression.addToSuppression")}
            </h4>
            <button type="button" onClick={() => setShowForm(false)}>
              <X size={20} className="text-surface-400 hover:text-surface-600" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("suppression.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="do-not-contact@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("suppression.reason")}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                placeholder="Unsubscribed, bounce, complaint..."
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="btn-primary"
            >
              {addMutation.isPending ? t("common.adding") : t("common.add")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("suppression.email")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("suppression.reason")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("suppression.source")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  {t("suppression.date")}
                </th>
                <th className="px-4 py-3 font-medium text-surface-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !entries?.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    {t("suppression.listEmpty")}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {entry.emailNormalized}
                    </td>
                    <td className="px-4 py-3 text-surface-700">
                      {entry.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-surface-100 text-surface-600">
                        {entry.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {format(new Date(entry.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              t("suppression.confirmRemove", { email: entry.emailNormalized })
                            )
                          ) {
                            deleteMutation.mutate(entry.id);
                          }
                        }}
                        className="text-surface-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
