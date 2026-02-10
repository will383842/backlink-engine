// ---------------------------------------------------------------------------
// Backlink Engine – API Service (Axios)
// ---------------------------------------------------------------------------

import axios from "axios";
import toast from "react-hot-toast";
import type {
  Prospect,
  Contact,
  Campaign,
  Enrollment,
  Event,
  Backlink,
  LinkableAsset,
  OutreachTemplate,
  SuppressionEntry,
  DashboardToday,
  DashboardStats,
  PipelineCounts,
  SitePreview,
  BulkIngestResult,
  ProspectFilters,
  ContactFilters,
  BacklinkFilters,
  ReplyFilters,
  PaginatedResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach JWT from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("bl_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 -> redirect to /login, toast on other errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem("bl_token");
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else {
      const message =
        error.response?.data?.error || error.message || "An error occurred";
      toast.error(message);
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Helper to build query string from filters (strips undefined values)
// ---------------------------------------------------------------------------

function toParams(filters: Record<string, unknown> = {}): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params[key] = String(value);
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: { id: number; email: string; name: string; role: string } }> {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export async function getProspects(
  filters: ProspectFilters = {},
): Promise<PaginatedResponse<Prospect>> {
  const { data } = await api.get("/prospects", { params: toParams(filters as Record<string, unknown>) });
  const total = data.pagination.total;
  const limit = data.pagination.limit;
  return {
    data: data.data,
    total,
    page: data.pagination.page,
    pageSize: limit,
    totalPages: data.pagination.totalPages ?? (Math.ceil(total / limit) || 1),
  };
}

export async function getProspect(id: number): Promise<Prospect> {
  const { data } = await api.get(`/prospects/${id}`);
  return data.data;
}

export async function createProspect(body: {
  url: string;
  email?: string;
  name?: string;
  contactFormUrl?: string;
  notes?: string;
}): Promise<Prospect> {
  const { data } = await api.post("/prospects", body);
  return data.data;
}

export async function updateProspect(
  id: number,
  body: {
    language?: string;
    country?: string;
    tier?: number;
    score?: number;
    status?: string;
    contactFormUrl?: string;
    hasRealTraffic?: boolean;
    isPbn?: boolean;
    nextFollowupAt?: string;
  },
): Promise<Prospect> {
  const { data } = await api.put(`/prospects/${id}`, body);
  return data.data;
}

export async function bulkImport(
  csv: string,
): Promise<BulkIngestResult> {
  const { data } = await api.post("/prospects/bulk", { csv });
  return data.data;
}

// ---------------------------------------------------------------------------
// Ingest (scraper endpoint)
// ---------------------------------------------------------------------------

export async function ingestStats(): Promise<{
  today: { received: number; created: number; duplicates: number };
  thisWeek: { received: number; created: number };
  thisMonth: { received: number; created: number };
}> {
  const { data } = await api.get("/ingest/stats");
  return data;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function getContacts(
  filters: ContactFilters = {},
): Promise<PaginatedResponse<Contact>> {
  const { data } = await api.get("/contacts", { params: toParams(filters as Record<string, unknown>) });
  const total = data.pagination.total;
  const limit = data.pagination.limit;
  return {
    data: data.data,
    total,
    page: data.pagination.page,
    pageSize: limit,
    totalPages: data.pagination.totalPages ?? (Math.ceil(total / limit) || 1),
  };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function getCampaigns(): Promise<Campaign[]> {
  const { data } = await api.get("/campaigns");
  return data.data;
}

export async function createCampaign(body: {
  name: string;
  language: string;
  targetTier?: number;
  targetCountry?: string;
  sequenceConfig: Record<string, unknown>;
  stopOnReply?: boolean;
  stopOnUnsub?: boolean;
  stopOnBounce?: boolean;
}): Promise<Campaign> {
  const { data } = await api.post("/campaigns", body);
  return data.data;
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export async function enrollProspect(
  campaignId: number,
  prospectId: number,
): Promise<Enrollment> {
  const { data } = await api.post(`/campaigns/${campaignId}/enroll`, { prospectId });
  return data.data;
}

// ---------------------------------------------------------------------------
// Backlinks
// ---------------------------------------------------------------------------

export async function getBacklinks(
  filters: BacklinkFilters = {},
): Promise<PaginatedResponse<Backlink>> {
  const { data } = await api.get("/backlinks", { params: toParams(filters as Record<string, unknown>) });
  const total = data.pagination.total;
  const limit = data.pagination.limit;
  return {
    data: data.data,
    total,
    page: data.pagination.page,
    pageSize: limit,
    totalPages: data.pagination.totalPages ?? (Math.ceil(total / limit) || 1),
  };
}

export async function verifyAllBacklinks(): Promise<{ queued: number }> {
  const { data } = await api.post("/backlinks/verify-all");
  return data;
}

// ---------------------------------------------------------------------------
// Assets & Templates
// ---------------------------------------------------------------------------

export async function getAssets(): Promise<LinkableAsset[]> {
  const { data } = await api.get("/assets");
  return data.data;
}

export async function getTemplates(): Promise<OutreachTemplate[]> {
  const { data } = await api.get("/templates");
  return data.data;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardToday(): Promise<DashboardToday> {
  const { data } = await api.get("/dashboard/today");
  return data;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get("/dashboard/stats");
  return data;
}

export async function getDashboardPipeline(): Promise<PipelineCounts> {
  const { data } = await api.get("/dashboard/pipeline");
  return data;
}

// ---------------------------------------------------------------------------
// Suppression list
// ---------------------------------------------------------------------------

export async function getSuppressionList(): Promise<SuppressionEntry[]> {
  const { data } = await api.get("/suppression");
  return data.data;
}

export async function addToSuppression(
  email: string,
  reason: string,
): Promise<SuppressionEntry> {
  const { data } = await api.post("/suppression", { email, reason });
  return data.data;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export async function getTimeline(
  prospectId: number,
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<Event>> {
  const { data } = await api.get(`/prospects/${prospectId}/timeline`, {
    params: { page: String(page), limit: String(limit) },
  });
  const total = data.pagination.total;
  const pageLimit = data.pagination.limit;
  return {
    data: data.data,
    total,
    page: data.pagination.page,
    pageSize: pageLimit,
    totalPages: data.pagination.totalPages ?? (Math.ceil(total / pageLimit) || 1),
  };
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export async function getReplies(
  filters: ReplyFilters = {},
): Promise<PaginatedResponse<Event>> {
  const { data } = await api.get("/replies", { params: toParams(filters as Record<string, unknown>) });
  const total = data.pagination.total;
  const limit = data.pagination.limit;
  return {
    data: data.data,
    total,
    page: data.pagination.page,
    pageSize: limit,
    totalPages: data.pagination.totalPages ?? (Math.ceil(total / limit) || 1),
  };
}

// ---------------------------------------------------------------------------
// Re-contact suggestions
// ---------------------------------------------------------------------------

export async function getRecontactSuggestions(
  minScore: number,
  minMonths: number,
): Promise<Prospect[]> {
  const { data } = await api.get("/prospects/recontact-suggestions", {
    params: { minScore: String(minScore), minMonths: String(minMonths) },
  });
  return data.data;
}

// ---------------------------------------------------------------------------
// Site preview
// ---------------------------------------------------------------------------

export async function fetchSitePreview(domain: string): Promise<SitePreview> {
  const { data } = await api.get("/tools/site-preview", {
    params: { domain },
  });
  return data;
}

export default api;
