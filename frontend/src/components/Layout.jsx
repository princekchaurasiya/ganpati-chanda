import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, HandCoins, Receipt, FileDown, Settings, Plus, X } from "lucide-react";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard-tab", end: true },
  { to: "/list", label: "Chanda", icon: HandCoins, testid: "nav-chanda-tab" },
  { to: "/expenses", label: "खर्चे", icon: Receipt, testid: "nav-expenses-tab" },
  { to: "/reports", label: "Reports", icon: FileDown, testid: "nav-reports-tab" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings-tab" },
];

export default function Layout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const activeTab = tabs.find((t) => (t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to)));

  const goto = (path) => { setAddOpen(false); nav(path); };

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
              <div className="text-lg font-bold tracking-tight text-slate-900" style={{ fontFamily: "Outfit" }}>
                Chanda Register
              </div>
              <div className="text-xs text-slate-500 -mt-0.5">{activeTab?.label || "Dashboard"}</div>
            </div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            data-testid="header-add-btn"
            className="hidden md:inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-nav">
        <Outlet />
      </main>

      {/* Floating Add button (mobile) */}
      <button
        onClick={() => setAddOpen(true)}
        data-testid="fab-add-btn"
        className="md:hidden fixed right-4 z-40 bg-teal-600 text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
        aria-label="Add"
      >
        <Plus size={26} />
      </button>

      {/* Add sheet */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setAddOpen(false)}
          data-testid="add-sheet"
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">Add New</h3>
              <button onClick={() => setAddOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => goto("/add")}
                data-testid="add-chanda-choice"
                className="w-full h-14 rounded-2xl bg-emerald-50 hover:bg-emerald-100 flex items-center gap-3 px-4 text-left border border-emerald-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <HandCoins size={20} />
                </div>
                <div>
                  <div className="font-semibold text-emerald-900">Chanda (चंदा)</div>
                  <div className="text-xs text-emerald-700">Money collected / expected</div>
                </div>
              </button>
              <button
                onClick={() => goto("/expenses/add")}
                data-testid="add-expense-choice"
                className="w-full h-14 rounded-2xl bg-red-50 hover:bg-red-100 flex items-center gap-3 px-4 text-left border border-red-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center">
                  <Receipt size={20} />
                </div>
                <div>
                  <div className="font-semibold text-red-900">Expense (खर्चा)</div>
                  <div className="text-xs text-red-700">Money spent</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

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
