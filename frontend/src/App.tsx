import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectDetail from "./pages/ProspectDetail";
import QuickAdd from "./pages/QuickAdd";
import BulkImport from "./pages/BulkImport";
import Campaigns from "./pages/Campaigns";
import Templates from "./pages/Templates";
import MessageTemplates from "./pages/MessageTemplates";
import Backlinks from "./pages/Backlinks";
import Assets from "./pages/Assets";
import Replies from "./pages/Replies";
import Suppression from "./pages/Suppression";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import RecontactSuggestions from "./pages/RecontactSuggestions";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("bl_token");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
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
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="templates" element={<Templates />} />
          <Route path="message-templates" element={<MessageTemplates />} />
          <Route path="backlinks" element={<Backlinks />} />
          <Route path="assets" element={<Assets />} />
          <Route path="replies" element={<Replies />} />
          <Route path="suppression" element={<Suppression />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="recontact" element={<RecontactSuggestions />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
