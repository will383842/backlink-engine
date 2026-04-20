import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { LayoutDashboard, Users, PlusCircle, Upload, MessageSquare, Link as LinkIcon, Package, Mail, Send, SquareSplitVertical, ShieldOff, Settings, BarChart3, Menu, X, LogOut, RefreshCcw, FileText, Satellite, Megaphone, Activity } from "lucide-react";
import { useTranslation } from "@/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

// Grouped sidebar — each section represents a workflow area
const navSections: NavSection[] = [
  {
    labelKey: "nav.section.overview",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
      { to: "/reports", labelKey: "nav.reports", icon: <BarChart3 size={18} /> },
      { to: "/mailbox-monitor", labelKey: "nav.mailboxMonitor", icon: <Mail size={18} /> },
      { to: "/vps-health", labelKey: "nav.vpsHealth", icon: <Activity size={18} /> },
    ],
  },
  {
    labelKey: "nav.section.prospects",
    items: [
      { to: "/prospects", labelKey: "nav.prospects", icon: <Users size={18} /> },
      { to: "/quick-add", labelKey: "nav.quickAdd", icon: <PlusCircle size={18} /> },
      { to: "/import", labelKey: "nav.bulkImport", icon: <Upload size={18} /> },
    ],
  },
  {
    labelKey: "nav.section.campaigns",
    items: [
      { to: "/campaigns", labelKey: "nav.campaigns", icon: <Megaphone size={18} /> },
      { to: "/ab-testing", labelKey: "nav.abTesting", icon: <SquareSplitVertical size={18} /> },
      { to: "/assets", labelKey: "nav.assets", icon: <Package size={18} /> },
    ],
  },
  {
    labelKey: "nav.section.tools",
    items: [
      { to: "/form-outreach", labelKey: "nav.formOutreach", icon: <FileText size={18} /> },
      { to: "/message-templates", labelKey: "nav.messageTemplates", icon: <MessageSquare size={18} /> },
      { to: "/recontact", labelKey: "nav.recontact", icon: <RefreshCcw size={18} /> },
      { to: "/suppression", labelKey: "nav.suppression", icon: <ShieldOff size={18} /> },
      { to: "/mc-sync", labelKey: "nav.mcSync", icon: <Satellite size={18} /> },
    ],
  },
  {
    labelKey: "nav.section.activity",
    items: [
      { to: "/mailboxes", labelKey: "nav.mailboxes", icon: <Mail size={18} /> },
      { to: "/sent-emails", labelKey: "nav.sentEmails", icon: <Send size={18} /> },
      { to: "/replies", labelKey: "nav.replies", icon: <MessageSquare size={18} /> },
      { to: "/backlinks", labelKey: "nav.backlinks", icon: <LinkIcon size={18} /> },
    ],
  },
  {
    labelKey: "nav.section.config",
    items: [
      { to: "/settings", labelKey: "nav.settings", icon: <Settings size={18} /> },
    ],
  },
];

const pageTitleKeys: Record<string, string> = {
  "/": "pageTitles.dashboard",
  "/prospects": "pageTitles.prospects",
  "/quick-add": "pageTitles.quickAdd",
  "/import": "pageTitles.bulkImport",
  "/message-templates": "pageTitles.messageTemplates",
  "/backlinks": "pageTitles.backlinks",
  "/assets": "pageTitles.assets",
  "/replies": "pageTitles.replies",
  "/form-outreach": "pageTitles.formOutreach",
  "/sent-emails": "pageTitles.sentEmails",
  "/ab-testing": "pageTitles.abTesting",
  "/campaigns": "pageTitles.campaigns",
  "/mc-sync": "pageTitles.mcSync",
  "/recontact": "pageTitles.recontact",
  "/suppression": "pageTitles.suppression",
  "/settings": "pageTitles.settings",
  "/reports": "pageTitles.reports",
  "/mailboxes": "nav.mailboxes",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { t } = useTranslation();

  const titleKey =
    pageTitleKeys[location.pathname] ||
    (location.pathname.startsWith("/prospects/") ? "pageTitles.prospectDetail" : "") ||
    (location.pathname.startsWith("/campaigns/") ? "pageTitles.campaigns" : "");

  const currentTitle = titleKey ? t(titleKey) : "";

  async function handleLogout() {
    try {
      // Backend destroys the session cookie. Best-effort — even if this
      // fails we still clear local state and redirect.
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-surface-900 text-white transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-brand-400">Backlink</span> Engine
          </h1>
          <button
            className="lg:hidden text-surface-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-6">
            {navSections.map((section) => (
              <div key={section.labelKey}>
                <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  {t(section.labelKey)}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-brand-600/20 text-brand-400"
                              : "text-surface-300 hover:bg-surface-800 hover:text-white"
                          }`
                        }
                      >
                        {item.icon}
                        {t(item.labelKey)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-surface-700 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
          >
            <LogOut size={20} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-surface-200 bg-white px-4 lg:px-8">
          <button
            className="lg:hidden text-surface-600 hover:text-surface-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-semibold text-surface-900">
            {currentTitle}
          </h2>
          <div className="flex-1" />
          <LanguageSwitcher />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
