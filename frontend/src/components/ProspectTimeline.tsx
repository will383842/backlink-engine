// ---------------------------------------------------------------------------
// ProspectTimeline – Vertical timeline of events for a prospect
// ---------------------------------------------------------------------------

import React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Send,
  Mail,
  MailOpen,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  UserPlus,
  Settings,
  Clock,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useTimeline } from "@/hooks/useApi";
import type { Event } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProspectTimelineProps {
  prospectId: number;
}

// ---------------------------------------------------------------------------
// Event type -> icon & color mapping
// ---------------------------------------------------------------------------

interface EventStyle {
  icon: LucideIcon;
  color: string; // Tailwind color class for the dot/icon
  bgColor: string; // Tailwind bg class for the icon container
}

const EVENT_STYLES: Record<string, EventStyle> = {
  // Green events (success)
  prospect_won: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  link_verified: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  backlink_detected: { icon: Link2, color: "text-green-600", bgColor: "bg-green-100" },

  // Red events (negative)
  prospect_lost: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  link_lost: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  bounce: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100" },
  unsubscribe: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },

  // Blue events (outreach)
  email_sent: { icon: Send, color: "text-blue-600", bgColor: "bg-blue-100" },
  enrolled: { icon: Mail, color: "text-blue-600", bgColor: "bg-blue-100" },
  email_opened: { icon: MailOpen, color: "text-blue-600", bgColor: "bg-blue-100" },
  followup_sent: { icon: Send, color: "text-blue-600", bgColor: "bg-blue-100" },

  // Yellow events (replies/interaction)
  reply_received: { icon: MessageSquare, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  replied: { icon: MessageSquare, color: "text-yellow-600", bgColor: "bg-yellow-100" },

  // Gray events (system/status)
  prospect_created: { icon: UserPlus, color: "text-surface-500", bgColor: "bg-surface-100" },
  prospect_ingested: { icon: UserPlus, color: "text-surface-500", bgColor: "bg-surface-100" },
  status_changed: { icon: RefreshCw, color: "text-surface-500", bgColor: "bg-surface-100" },
  contact_added: { icon: UserPlus, color: "text-surface-500", bgColor: "bg-surface-100" },
  enrichment_complete: { icon: Settings, color: "text-surface-500", bgColor: "bg-surface-100" },
};

const DEFAULT_STYLE: EventStyle = {
  icon: Clock,
  color: "text-surface-400",
  bgColor: "bg-surface-100",
};

function getEventStyle(eventType: string): EventStyle {
  return EVENT_STYLES[eventType] ?? DEFAULT_STYLE;
}

// ---------------------------------------------------------------------------
// Event source -> badge color
// ---------------------------------------------------------------------------

function getSourceBadgeClasses(eventSource: string): string {
  switch (eventSource) {
    case "api":
      return "bg-brand-50 text-brand-700";
    case "mailwizz":
    case "mailwizz_webhook":
      return "bg-purple-50 text-purple-700";
    case "scraper_ingest":
    case "scraper":
      return "bg-orange-50 text-orange-700";
    case "csv_import":
      return "bg-teal-50 text-teal-700";
    case "system":
    case "cron":
      return "bg-surface-100 text-surface-600";
    default:
      return "bg-surface-50 text-surface-500";
  }
}

// ---------------------------------------------------------------------------
// Build human-readable description from event data
// ---------------------------------------------------------------------------

function describeEvent(event: Event): string {
  const data = event.data ?? {};

  switch (event.eventType) {
    case "prospect_created":
    case "prospect_ingested":
      return `Prospect added${data.url ? ` from ${data.url}` : ""}`;
    case "status_changed":
      return `Status changed from ${data.from ?? "?"} to ${data.to ?? "?"}`;
    case "contact_added":
      return `Contact added: ${data.email ?? "unknown"}${data.role ? ` (${data.role})` : ""}`;
    case "email_sent":
    case "followup_sent":
      return `Email sent${data.subject ? `: "${data.subject}"` : ""}${data.step ? ` (step ${data.step})` : ""}`;
    case "email_opened":
      return `Email opened${data.subject ? `: "${data.subject}"` : ""}`;
    case "enrolled":
      return `Enrolled in campaign${data.campaignName ? ` "${data.campaignName}"` : ""}`;
    case "reply_received":
    case "replied":
      return `Reply received${data.category ? ` - ${data.category}` : ""}`;
    case "bounce":
      return `Email bounced${data.email ? ` (${data.email})` : ""}`;
    case "unsubscribe":
      return `Contact unsubscribed${data.email ? ` (${data.email})` : ""}`;
    case "prospect_won":
      return "Prospect marked as WON";
    case "prospect_lost":
      return `Prospect marked as LOST${data.reason ? `: ${data.reason}` : ""}`;
    case "link_verified":
      return `Backlink verified${data.pageUrl ? ` on ${data.pageUrl}` : ""}`;
    case "link_lost":
      return `Backlink lost${data.pageUrl ? ` on ${data.pageUrl}` : ""}`;
    case "backlink_detected":
      return `New backlink detected${data.pageUrl ? ` on ${data.pageUrl}` : ""}`;
    case "enrichment_complete":
      return `Enrichment completed${data.mozDa ? ` (DA: ${data.mozDa})` : ""}`;
    default:
      return event.eventType.replace(/_/g, " ");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProspectTimeline: React.FC<ProspectTimelineProps> = ({ prospectId }) => {
  const { data: timelineData, isLoading, error } = useTimeline(prospectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="ml-2 text-sm text-surface-500">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load timeline: {error.message}
      </div>
    );
  }

  const events = timelineData?.data ?? [];

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-surface-400">
        No events yet for this prospect.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 h-full w-0.5 bg-surface-200" />

      <ul className="space-y-6">
        {events.map((event, index) => {
          const style = getEventStyle(event.eventType);
          const Icon = style.icon;
          const isLast = index === events.length - 1;

          return (
            <li key={event.id} className="relative flex gap-4">
              {/* Icon circle */}
              <div
                className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${style.bgColor}`}
              >
                <Icon className={`h-4 w-4 ${style.color}`} />
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-2"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Event type label */}
                  <span className="text-sm font-medium text-surface-900">
                    {event.eventType.replace(/_/g, " ")}
                  </span>

                  {/* Source badge */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getSourceBadgeClasses(event.eventSource)}`}
                  >
                    {event.eventSource}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-0.5 text-sm text-surface-600">
                  {describeEvent(event)}
                </p>

                {/* Contact info if present */}
                {event.contact && (
                  <p className="mt-0.5 text-xs text-surface-400">
                    Contact: {event.contact.name ?? event.contact.email}
                  </p>
                )}

                {/* Timestamp */}
                <p className="mt-1 text-xs text-surface-400">
                  <time
                    dateTime={event.createdAt}
                    title={format(new Date(event.createdAt), "PPpp")}
                  >
                    {format(new Date(event.createdAt), "dd MMM yyyy, HH:mm")}
                  </time>
                  <span className="ml-1.5 text-surface-300">
                    ({formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })})
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination info */}
      {timelineData && timelineData.total > timelineData.pageSize && (
        <p className="mt-4 text-center text-xs text-surface-400">
          Showing {events.length} of {timelineData.total} events
        </p>
      )}
    </div>
  );
};

export default ProspectTimeline;
