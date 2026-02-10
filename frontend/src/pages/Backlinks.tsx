import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Backlink, LinkType } from "@/types";

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  dofollow: "bg-emerald-100 text-emerald-700",
  nofollow: "bg-surface-100 text-surface-600",
  ugc: "bg-purple-100 text-purple-700",
  sponsored: "bg-amber-100 text-amber-700",
};

export default function Backlinks() {
  const queryClient = useQueryClient();
  const [filterLive, setFilterLive] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const { data: backlinks, isLoading } = useQuery<Backlink[]>({
    queryKey: ["backlinks", filterLive, filterType],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterLive) params.isLive = filterLive;
      if (filterType) params.linkType = filterType;
      const res = await api.get("/backlinks", { params });
      return res.data;
    },
  });

  const verifyAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/backlinks/verify-all");
      return res.data;
    },
    onSuccess: (data: { verified: number }) => {
      toast.success(`Verification started for ${data.verified} backlinks`);
      queryClient.invalidateQueries({ queryKey: ["backlinks"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="card flex flex-wrap items-center gap-3">
        <select
          value={filterLive}
          onChange={(e) => setFilterLive(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Status</option>
          <option value="true">Live</option>
          <option value="false">Lost</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Types</option>
          <option value="dofollow">Dofollow</option>
          <option value="nofollow">Nofollow</option>
          <option value="ugc">UGC</option>
          <option value="sponsored">Sponsored</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={() => verifyAllMutation.mutate()}
          disabled={verifyAllMutation.isPending}
          className="btn-primary"
        >
          <RefreshCcw
            size={16}
            className={`mr-1.5 ${verifyAllMutation.isPending ? "animate-spin" : ""}`}
          />
          {verifyAllMutation.isPending ? "Verifying..." : "Verify All"}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Source Page
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Target URL
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Anchor Text
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Type
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Verified
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Live
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Last Verified
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !backlinks?.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    No backlinks found.
                  </td>
                </tr>
              ) : (
                backlinks.map((bl) => (
                  <tr key={bl.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {bl.pageUrl}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-surface-600">
                      {bl.targetUrl}
                    </td>
                    <td className="px-4 py-3 text-surface-700">
                      {bl.anchorText}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${LINK_TYPE_COLORS[bl.linkType as LinkType]}`}
                      >
                        {bl.linkType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          bl.isVerified ? "bg-emerald-500" : "bg-surface-300"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          bl.isLive ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {bl.lastVerifiedAt
                        ? format(new Date(bl.lastVerifiedAt), "dd MMM yyyy HH:mm")
                        : "Never"}
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
