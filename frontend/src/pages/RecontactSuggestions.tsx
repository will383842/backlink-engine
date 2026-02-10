import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { ReplyCategory } from "@/types";

interface RecontactProspect {
  id: string;
  domain: string;
  score: number;
  domainAuthority: number | null;
  lastContactedAt: string;
  originalReplyCategory: ReplyCategory | null;
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

export default function RecontactSuggestions() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: prospects, isLoading } = useQuery<RecontactProspect[]>({
    queryKey: ["recontact-suggestions"],
    queryFn: async () => {
      const res = await api.get("/prospects/recontact-suggestions");
      return res.data;
    },
  });

  const recontactMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const res = await api.post("/prospects/bulk-recontact", { ids });
      return res.data;
    },
    onSuccess: (data: { recontacted: number }) => {
      toast.success(`${data.recontacted} prospects queued for recontact`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["recontact-suggestions"] });
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (!prospects) return;
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            Recontact Suggestions
          </h3>
          <p className="text-sm text-surface-500">
            LOST prospects older than 6 months with qualifying scores
          </p>
        </div>
        <button
          onClick={() => recontactMutation.mutate()}
          disabled={selectedIds.size === 0 || recontactMutation.isPending}
          className="btn-primary"
        >
          <RefreshCcw
            size={16}
            className={`mr-1.5 ${recontactMutation.isPending ? "animate-spin" : ""}`}
          />
          {recontactMutation.isPending
            ? "Processing..."
            : `Recontact Selected (${selectedIds.size})`}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      !!prospects?.length &&
                      selectedIds.size === prospects.length
                    }
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Domain
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Score
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">DA</th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Last Contact
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Reply Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !prospects?.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    No recontact suggestions at this time.
                  </td>
                </tr>
              ) : (
                prospects.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-surface-50 ${
                      selectedIds.has(p.id) ? "bg-brand-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {p.domain}
                    </td>
                    <td className="px-4 py-3">{p.score}</td>
                    <td className="px-4 py-3">
                      {p.domainAuthority ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {format(new Date(p.lastContactedAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      {p.originalReplyCategory ? (
                        <span
                          className={`badge ${CATEGORY_COLORS[p.originalReplyCategory]}`}
                        >
                          {p.originalReplyCategory.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">
                          No reply
                        </span>
                      )}
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
