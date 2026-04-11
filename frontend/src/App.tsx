import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import { useCurrentUser } from "./hooks/useCurrentUser";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectDetail from "./pages/ProspectDetail";
import QuickAdd from "./pages/QuickAdd";
import BulkImport from "./pages/BulkImport";
import MessageTemplates from "./pages/MessageTemplates";
import Backlinks from "./pages/Backlinks";
import Assets from "./pages/Assets";
import Replies from "./pages/Replies";
import Suppression from "./pages/Suppression";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import RecontactSuggestions from "./pages/RecontactSuggestions";
import SentEmails from "./pages/SentEmails";
import AbTestResults from "./pages/AbTestResults";
import FormOutreach from "./pages/FormOutreach";
import MissionControlSync from "./pages/MissionControlSync";
import Broadcast from "./pages/Broadcast";
import Campaigns from "./pages/Campaigns";
import CampaignsHub from "./pages/CampaignsHub";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasToken = !!localStorage.getItem("bl_token");
  // Validate session against the backend. Query is disabled when no token is
  // present so we don't issue pointless 401s from the login screen. On 401,
  // the axios interceptor already clears the token and redirects; on other
  // errors (network, 500) we render children optimistically so transient
  // backend issues don't log the user out.
  const { isLoading } = useCurrentUser({ enabled: hasToken });

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <div className="text-sm text-surface-500">Loading...</div>
      </div>
    );
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
              <Layout />
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
          <Route path="reports" element={<Reports />} />
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
