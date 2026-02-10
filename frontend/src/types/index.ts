// ---------------------------------------------------------------------------
// Backlink Engine – Frontend Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type ProspectStatus =
  | "NEW"
  | "ENRICHING"
  | "READY_TO_CONTACT"
  | "CONTACTED_EMAIL"
  | "CONTACTED_MANUAL"
  | "FOLLOWUP_DUE"
  | "REPLIED"
  | "NEGOTIATING"
  | "WON"
  | "LINK_PENDING"
  | "LINK_VERIFIED"
  | "LINK_LOST"
  | "RE_CONTACTED"
  | "LOST"
  | "DO_NOT_CONTACT";

export type ReplyCategory =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "ASKING_PRICE"
  | "ASKING_QUESTIONS"
  | "ALREADY_LINKED"
  | "OUT_OF_OFFICE"
  | "BOUNCE"
  | "UNSUBSCRIBE"
  | "SPAM"
  | "OTHER";

export type LinkType = "dofollow" | "nofollow" | "ugc" | "sponsored";

export type TemplatePurpose =
  | "INITIAL_OUTREACH"
  | "FOLLOW_UP"
  | "RECONTACT"
  | "THANK_YOU"
  | "NEGOTIATION";

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

export interface Prospect {
  id: number;
  domain: string;
  source: "manual" | "csv_import" | "scraper";
  language: string | null;
  country: string | null;
  tier: number;
  score: number;
  mozDa: number | null;
  openPagerank: number | null;
  spamScore: number;
  hasRealTraffic: boolean;
  isPbn: boolean;
  linkNeighborhoodScore: number | null;
  outboundCategories: Record<string, unknown> | null;
  contactFormUrl: string | null;
  status: ProspectStatus;
  firstContactedAt: string | null;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
  sourceUrls?: SourceUrl[];
  enrollments?: Enrollment[];
  events?: Event[];
  backlinks?: Backlink[];
  _count?: {
    backlinks: number;
    events: number;
    enrollments: number;
  };
}

export interface SourceUrl {
  id: number;
  prospectId: number;
  url: string;
  urlNormalized: string;
  canonicalUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  discoveredVia: string;
  notes: string | null;
  createdAt: string;
}

export interface Contact {
  id: number;
  prospectId: number;
  email: string;
  emailNormalized: string;
  name: string | null;
  role: string;
  emailStatus: string;
  discoveredVia: string;
  optedOut: boolean;
  optedOutAt: string | null;
  createdAt: string;
  prospect?: Pick<Prospect, "id" | "domain" | "status">;
}

export interface Campaign {
  id: number;
  name: string;
  language: string;
  targetTier: number | null;
  targetCountry: string | null;
  mailwizzListUid: string | null;
  sequenceConfig: Record<string, unknown>;
  stopOnReply: boolean;
  stopOnUnsub: boolean;
  stopOnBounce: boolean;
  totalEnrolled: number;
  totalReplied: number;
  totalWon: number;
  isActive: boolean;
  createdAt: string;
  enrollments?: Enrollment[];
}

export interface Enrollment {
  id: number;
  contactId: number;
  campaignId: number;
  prospectId: number;
  mailwizzSubscriberUid: string | null;
  mailwizzListUid: string | null;
  campaignRef: string | null;
  currentStep: number;
  status: string;
  stoppedReason: string | null;
  enrolledAt: string;
  lastSentAt: string | null;
  nextSendAt: string | null;
  completedAt: string | null;
  contact?: Contact;
  campaign?: Pick<Campaign, "id" | "name">;
  prospect?: Prospect;
}

export interface Event {
  id: number;
  prospectId: number;
  contactId: number | null;
  enrollmentId: number | null;
  eventType: string;
  eventSource: string;
  userId: number | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  contact?: Pick<Contact, "id" | "email" | "name"> | null;
  enrollment?: Pick<Enrollment, "id" | "campaignId" | "status"> | null;
}

export interface Backlink {
  id: number;
  prospectId: number;
  sourceUrlId: number | null;
  pageUrl: string;
  targetUrl: string;
  anchorText: string | null;
  linkType: string;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  isLive: boolean;
  lostAt: string | null;
  hasWidget: boolean;
  hasBadge: boolean;
  firstDetectedAt: string | null;
  createdAt: string;
  sourceUrl?: Pick<SourceUrl, "id" | "url" | "title"> | null;
}

export interface LinkableAsset {
  id: number;
  title: string;
  slug: string;
  assetType: string;
  url: string;
  description: string | null;
  availableLanguages: string[];
  totalBacklinks: number;
  totalMentions: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface OutreachTemplate {
  id: number;
  name: string;
  language: string;
  purpose: string;
  subject: string;
  body: string;
  formalityLevel: string;
  culturalNotes: string | null;
  timesUsed: number;
  replyRate: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface SuppressionEntry {
  id: number;
  emailNormalized: string;
  reason: string;
  source: string;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Ingestion types
// ---------------------------------------------------------------------------

export interface IngestInput {
  url: string;
  email?: string;
  name?: string;
  language?: string;
  country?: string;
  contactFormUrl?: string;
  notes?: string;
  source: "manual" | "csv_import" | "scraper";
  meta?: Record<string, unknown>;
}

export interface IngestResult {
  status: "created" | "duplicate" | "error";
  prospectId?: number;
  existingStatus?: string;
  error?: string;
}

export interface BulkIngestResult {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
  details: IngestResult[];
}

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

export interface DashboardToday {
  newProspects: number;
  emailsSent: number;
  repliesReceived: number;
  backlinksVerified: number;
  replyRate: number;
  openRate: number;
}

export interface DashboardStats {
  totalProspects: number;
  totalContacts: number;
  totalBacklinks: number;
  liveBacklinks: number;
  totalCampaigns: number;
  activeCampaigns: number;
  avgScore: number;
  avgDa: number;
  wonThisMonth: number;
  wonLastMonth: number;
}

export interface PipelineCounts {
  NEW: number;
  ENRICHING: number;
  READY_TO_CONTACT: number;
  CONTACTED_EMAIL: number;
  CONTACTED_MANUAL: number;
  FOLLOWUP_DUE: number;
  REPLIED: number;
  NEGOTIATING: number;
  WON: number;
  LINK_PENDING: number;
  LINK_VERIFIED: number;
  LINK_LOST: number;
  RE_CONTACTED: number;
  LOST: number;
  DO_NOT_CONTACT: number;
}

// ---------------------------------------------------------------------------
// Site preview / neighborhood
// ---------------------------------------------------------------------------

export interface SitePreview {
  domain: string;
  title: string | null;
  description: string | null;
  screenshotUrl: string | null;
  mozDa: number | null;
  spamScore: number | null;
  language: string | null;
  country: string | null;
}

export interface CategoryResult {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface NeighborhoodPreAnalysis {
  domain: string;
  totalOutboundLinks: number;
  categories: CategoryResult[];
  toxicPercentage: number;
  linkNeighborhoodScore: number;
  flagged: boolean;
}

// ---------------------------------------------------------------------------
// Filters & pagination
// ---------------------------------------------------------------------------

export interface ProspectFilters {
  status?: ProspectStatus;
  country?: string;
  language?: string;
  tier?: number;
  source?: string;
  scoreMin?: number;
  scoreMax?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ContactFilters {
  prospectId?: number;
  emailStatus?: string;
  optedOut?: boolean;
  page?: number;
  limit?: number;
}

export interface BacklinkFilters {
  prospectId?: number;
  isLive?: boolean;
  isVerified?: boolean;
  linkType?: string;
  page?: number;
  limit?: number;
}

export interface ReplyFilters {
  category?: ReplyCategory;
  campaignId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Reply (matches backend Event model for reply-type events)
// ---------------------------------------------------------------------------

export interface Reply {
  id: number;
  prospectId: number;
  prospectDomain: string;
  category: ReplyCategory;
  confidence: number;
  summary: string;
  fullText: string;
  suggestedAction: string | null;
  isHandled: boolean;
  receivedAt: string;
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  mailwizz: {
    apiUrl: string;
    apiKey: string;
    listUids: Record<string, string>;
  };
  imap: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  scoring: {
    minScoreForContact: number;
    minDaForContact: number;
    neighborhoodThreshold: number;
  };
  recontact: {
    delayMonths: number;
    maxRecontacts: number;
    minScoreForRecontact: number;
  };
  ai: {
    enabled: boolean;
    provider: string;
    apiKey: string;
  };
}

// ---------------------------------------------------------------------------
// Dashboard operational view
// ---------------------------------------------------------------------------

export interface DashboardData {
  urgent: {
    repliesToHandle: number;
    bounces: number;
    lostBacklinks: number;
  };
  todo: {
    prospectsReady: number;
    formsToFill: number;
  };
  opportunities: {
    lostRecontactable: number;
  };
  stats: {
    prospectsAddedBySource: Record<string, number>;
    sentToMailwizz: number;
    repliesReceived: number;
    backlinksWon: number;
  };
}
