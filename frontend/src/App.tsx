import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import { useCurrentUser } from "./hooks/useCurrentUser";
import Spinner from "./components/ui/Spinner";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazy-loaded pages — kept out of the initial bundle to speed up first paint.
// Login + Dashboard stay eager (most common entry points).
const Prospects = lazy(() => import("./pages/Prospects"));
const ProspectDetail = lazy(() => import("./pages/ProspectDetail"));
const QuickAdd = lazy(() => import("./pages/QuickAdd"));
const BulkImport = lazy(() => import("./pages/BulkImport"));
const MessageTemplates = lazy(() => import("./pages/MessageTemplates"));
const Backlinks = lazy(() => import("./pages/Backlinks"));
const Assets = lazy(() => import("./pages/Assets"));
const Replies = lazy(() => import("./pages/Replies"));
const Suppression = lazy(() => import("./pages/Suppression"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const MailboxMonitor = lazy(() => import("./pages/MailboxMonitor"));
const VpsHealth = lazy(() => import("./pages/VpsHealth"));
const RecontactSuggestions = lazy(() => import("./pages/RecontactSuggestions"));
const SentEmails = lazy(() => import("./pages/SentEmails"));
const AbTestResults = lazy(() => import("./pages/AbTestResults"));
const FormOutreach = lazy(() => import("./pages/FormOutreach"));
const MissionControlSync = lazy(() => import("./pages/MissionControlSync"));
const Broadcast = lazy(() => import("./pages/Broadcast"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignsHub = lazy(() => import("./pages/CampaignsHub"));
const ContactTypeMappings = lazy(() => import("./pages/ContactTypeMappings"));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size="lg" label="Loading..." />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth state lives entirely in the httpOnly session cookie — we trust the
  // backend via /auth/me. The axios interceptor redirects to /login on 401.
  const { isLoading, isError, error } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  // On explicit 401 the axios interceptor has already redirected. Guard here
  // against any other error path (e.g. query fired before interceptor ran).
  if (isError) {
    const status = (error as { response?: { status?: number } } | undefined)
      ?.response?.status;
    if (status === 401) {
      return <Navigate to="/login" replace />;
    }
    // Non-401: optimistic render — transient backend issues shouldn't log the
    // user out. Child components handle their own failures.
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "0.75rem",
            background: "#1e293b",
            color: "#f8fafc",
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <Layout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="prospects/:id" element={<ProspectDetail />} />
          <Route path="quick-add" element={<QuickAdd />} />
          <Route path="import" element={<BulkImport />} />
          <Route path="message-templates" element={<MessageTemplates />} />
          <Route path="backlinks" element={<Backlinks />} />
          <Route path="assets" element={<Assets />} />
          <Route path="replies" element={<Replies />} />
          <Route path="form-outreach" element={<FormOutreach />} />
          <Route path="sent-emails" element={<SentEmails />} />
          <Route path="ab-testing" element={<AbTestResults />} />
          <Route path="suppression" element={<Suppression />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/contact-types" element={<ContactTypeMappings />} />
          <Route path="reports" element={<Reports />} />
            <Route path="mailbox-monitor" element={<MailboxMonitor />} />
            <Route path="vps-health" element={<VpsHealth />} />
          {/* Unified Campaigns hub (outreach + broadcast) */}
          <Route path="campaigns" element={<CampaignsHub />} />
          <Route path="campaigns/outreach" element={<Campaigns />} />
          <Route path="campaigns/broadcast" element={<Broadcast />} />
          {/* Legacy redirect: /broadcast → /campaigns?type=broadcast */}
          <Route
            path="broadcast"
            element={<Navigate to="/campaigns?type=broadcast" replace />}
          />
          <Route path="mc-sync" element={<MissionControlSync />} />
          <Route path="recontact" element={<RecontactSuggestions />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
