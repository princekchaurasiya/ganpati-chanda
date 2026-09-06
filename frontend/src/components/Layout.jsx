import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, ListChecks, FileDown, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard-tab", end: true },
  { to: "/add", label: "जोड़ें", icon: PlusCircle, testid: "nav-add-tab" },
  { to: "/list", label: "List", icon: ListChecks, testid: "nav-list-tab" },
  { to: "/reports", label: "Reports", icon: FileDown, testid: "nav-reports-tab" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings-tab" },
];

export default function Layout() {
  const loc = useLocation();
  const activeTab = tabs.find((t) => (t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to)));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              चं
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900" style={{fontFamily:"Outfit"}}>
                Chanda Register
              </div>
              <div className="text-xs text-slate-500 -mt-0.5">{activeTab?.label || "Dashboard"}</div>
            </div>
          </div>
          <NavLink
            to="/add"
            data-testid="header-add-btn"
            className="hidden md:inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
          >
            <PlusCircle size={18} /> Add Chanda
          </NavLink>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-nav">
        <Outlet />
      </main>

      {/* Floating Add button (mobile) */}
      <NavLink
        to="/add"
        data-testid="fab-add-btn"
        className="md:hidden fixed right-4 z-50 bg-teal-600 text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
        aria-label="Add Chanda"
      >
        <PlusCircle size={26} />
      </NavLink>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-5xl mx-auto px-2 py-1.5 grid grid-cols-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              data-testid={t.testid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-colors ${
                  isActive ? "text-teal-700 bg-teal-50" : "text-slate-500 hover:text-slate-800"
                }`
              }
            >
              <t.icon size={20} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
