import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  Upload,
  Send,
  FileText,
  Link2,
  Package,
  Mail,
  ShieldOff,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  RefreshCcw,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/prospects", label: "Prospects", icon: <Users size={20} /> },
  { to: "/quick-add", label: "Quick Add", icon: <PlusCircle size={20} /> },
  { to: "/import", label: "Bulk Import", icon: <Upload size={20} /> },
  { to: "/campaigns", label: "Campaigns", icon: <Send size={20} /> },
  { to: "/templates", label: "Templates", icon: <FileText size={20} /> },
  { to: "/backlinks", label: "Backlinks", icon: <Link2 size={20} /> },
  { to: "/assets", label: "Assets", icon: <Package size={20} /> },
  { to: "/replies", label: "Replies", icon: <Mail size={20} /> },
  { to: "/recontact", label: "Recontact", icon: <RefreshCcw size={20} /> },
  { to: "/suppression", label: "Suppression", icon: <ShieldOff size={20} /> },
  { to: "/settings", label: "Settings", icon: <Settings size={20} /> },
  { to: "/reports", label: "Reports", icon: <BarChart3 size={20} /> },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/prospects": "Prospects",
  "/quick-add": "Quick Add",
  "/import": "Bulk Import",
  "/campaigns": "Campaigns",
  "/templates": "Templates",
  "/backlinks": "Backlinks",
  "/assets": "Assets",
  "/replies": "Replies",
  "/recontact": "Recontact Suggestions",
  "/suppression": "Suppression List",
  "/settings": "Settings",
  "/reports": "Reports",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith("/prospects/") ? "Prospect Detail" : "");

  function handleLogout() {
    localStorage.removeItem("bl_token");
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
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-600/20 text-brand-400"
                        : "text-surface-300 hover:bg-surface-800 hover:text-white"
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-surface-700 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
          >
            <LogOut size={20} />
            Logout
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
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
