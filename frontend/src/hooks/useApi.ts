// ---------------------------------------------------------------------------
// Backlink Engine – React Query Hooks
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  getProspects,
  getProspect,
  getCampaigns,
  getBacklinks,
  getDashboardToday,
  getDashboardStats,
  getDashboardPipeline,
  getReplies,
  getTimeline,
  createProspect,
  updateProspect,
  enrollProspect,
  bulkImport,
} from "@/services/api";

import type {
  Prospect,
  Campaign,
  Backlink,
  Event,
  DashboardToday,
  DashboardStats,
  PipelineCounts,
  BulkIngestResult,
  ProspectFilters,
  BacklinkFilters,
  ReplyFilters,
  PaginatedResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  prospects: (filters?: ProspectFilters) => ["prospects", filters] as const,
  prospect: (id: number) => ["prospect", id] as const,
  campaigns: () => ["campaigns"] as const,
  backlinks: (filters?: BacklinkFilters) => ["backlinks", filters] as const,
  dashboardToday: () => ["dashboard", "today"] as const,
  dashboardStats: () => ["dashboard", "stats"] as const,
  dashboardPipeline: () => ["dashboard", "pipeline"] as const,
  replies: (filters?: ReplyFilters) => ["replies", filters] as const,
  timeline: (prospectId: number) => ["timeline", prospectId] as const,
};

// ---------------------------------------------------------------------------
// Prospect queries
// ---------------------------------------------------------------------------

export function useProspects(
  filters: ProspectFilters = {},
): UseQueryResult<PaginatedResponse<Prospect>> {
  return useQuery({
    queryKey: queryKeys.prospects(filters),
    queryFn: () => getProspects(filters),
  });
}

export function useProspect(id: number): UseQueryResult<Prospect> {
  return useQuery({
    queryKey: queryKeys.prospect(id),
    queryFn: () => getProspect(id),
    enabled: id > 0,
  });
}

// ---------------------------------------------------------------------------
// Campaign queries
// ---------------------------------------------------------------------------

export function useCampaigns(): UseQueryResult<Campaign[]> {
  return useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: getCampaigns,
  });
}

// ---------------------------------------------------------------------------
// Backlink queries
// ---------------------------------------------------------------------------

export function useBacklinks(
  filters: BacklinkFilters = {},
): UseQueryResult<PaginatedResponse<Backlink>> {
  return useQuery({
    queryKey: queryKeys.backlinks(filters),
    queryFn: () => getBacklinks(filters),
  });
}

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

export function useDashboard(): {
  today: UseQueryResult<DashboardToday>;
  stats: UseQueryResult<DashboardStats>;
  pipeline: UseQueryResult<PipelineCounts>;
} {
  const today = useQuery({
    queryKey: queryKeys.dashboardToday(),
    queryFn: getDashboardToday,
    staleTime: 60_000, // refresh every 60s
  });

  const stats = useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: getDashboardStats,
    staleTime: 120_000,
  });

  const pipeline = useQuery({
    queryKey: queryKeys.dashboardPipeline(),
    queryFn: getDashboardPipeline,
    staleTime: 60_000,
  });

  return { today, stats, pipeline };
}

// ---------------------------------------------------------------------------
// Reply queries
// ---------------------------------------------------------------------------

export function useReplies(
  filters: ReplyFilters = {},
): UseQueryResult<PaginatedResponse<Event>> {
  return useQuery({
    queryKey: queryKeys.replies(filters),
    queryFn: () => getReplies(filters),
  });
}

// ---------------------------------------------------------------------------
// Timeline queries
// ---------------------------------------------------------------------------

export function useTimeline(
  prospectId: number,
): UseQueryResult<PaginatedResponse<Event>> {
  return useQuery({
    queryKey: queryKeys.timeline(prospectId),
    queryFn: () => getTimeline(prospectId),
    enabled: prospectId > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateProspect(): UseMutationResult<
  Prospect,
  Error,
  { url: string; email?: string; name?: string; contactFormUrl?: string; notes?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createProspect(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateProspect(): UseMutationResult<
  Prospect,
  Error,
  {
    id: number;
    data: {
      language?: string;
      country?: string;
      tier?: number;
      score?: number;
      status?: string;
      contactFormUrl?: string;
      hasRealTraffic?: boolean;
      isPbn?: boolean;
      nextFollowupAt?: string;
    };
  }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateProspect(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.prospect(variables.id) });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEnrollProspect(): UseMutationResult<
  unknown,
  Error,
  { campaignId: number; prospectId: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, prospectId }) => enrollProspect(campaignId, prospectId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospect(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBulkImport(): UseMutationResult<BulkIngestResult, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (csv) => bulkImport(csv),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
