import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, HandCoins, Receipt, Users, Settings, Plus, X, ArrowRightLeft, FileDown, HandHelping, Calendar, Check } from "lucide-react";
import { yearApi } from "@/lib/api";
import { getActiveYear, setActiveYear, DEFAULT_YEAR } from "@/lib/year";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard-tab", end: true },
  { to: "/list", label: "Chanda", icon: HandCoins, testid: "nav-chanda-tab" },
  { to: "/expenses", label: "खर्चे", icon: Receipt, testid: "nav-expenses-tab" },
  { to: "/members", label: "Members", icon: Users, testid: "nav-members-tab" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings-tab" },
];

export default function Layout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState([DEFAULT_YEAR]);
  const activeYear = getActiveYear();
  const activeTab = tabs.find((t) => (t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to)));

  useEffect(() => {
    yearApi.list()
      .then((r) => setAvailableYears(r.years && r.years.length > 0 ? r.years : [DEFAULT_YEAR]))
      .catch(() => {});
  }, []);

  const goto = (path) => { setAddOpen(false); nav(path); };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">चं</div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900" style={{ fontFamily: "Outfit" }}>Chanda Register</div>
              <div className="text-xs text-slate-500 -mt-0.5">{activeTab?.label || "Dashboard"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYearOpen(true)}
              data-testid="year-selector-btn"
              className="inline-flex items-center gap-1 px-2.5 h-10 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 text-sm"
              title="Filter by year"
            >
              <Calendar size={15} />
              <span className="tabular-nums">{activeYear}</span>
            </button>
            <NavLink to="/reports" data-testid="header-reports-btn-mobile"
              className="md:hidden inline-flex items-center gap-1 px-3 h-10 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 text-sm">
              <FileDown size={16} /> Export
            </NavLink>
            <NavLink to="/reports" data-testid="header-reports-btn"
              className="hidden md:inline-flex items-center gap-1.5 px-3 h-10 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">
              <FileDown size={16} /> Reports
            </NavLink>
            <button onClick={() => setAddOpen(true)} data-testid="header-add-btn"
              className="hidden md:inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
              <Plus size={18} /> Add
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-nav">
        <Outlet />
      </main>

      <button onClick={() => setAddOpen(true)} data-testid="fab-add-btn"
        className="md:hidden fixed right-4 z-40 bg-teal-600 text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
        aria-label="Add">
        <Plus size={26} />
      </button>

      {yearOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setYearOpen(false)} data-testid="year-sheet">
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={18} className="text-teal-600" /> Year filter
              </h3>
              <button onClick={() => setYearOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Pura app iss year ke data pe filtered rahega — chanda, expenses, transfers, dashboard sab.
            </div>
            <div className="space-y-1.5">
              <YearOption label="All years" value="all" active={activeYear === "all"} onSelect={() => setActiveYear("all")} testid="year-option-all" />
              {availableYears.map((y) => (
                <YearOption key={y} label={y} value={y} active={activeYear === y} onSelect={() => setActiveYear(y)} testid={`year-option-${y}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setAddOpen(false)} data-testid="add-sheet">
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">Add New</h3>
              <button onClick={() => setAddOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <SheetChoice testid="add-chanda-choice" onClick={() => goto("/add")}
                color="emerald" icon={<HandCoins size={20} />}
                title="Chanda Collection" sub="Money collected or promised from a donor" />
              <SheetChoice testid="add-transfer-choice" onClick={() => goto("/transfer/add")}
                color="teal" icon={<ArrowRightLeft size={20} />}
                title="Transfer Existing Collection" sub="Hand over cash from one member to another" />
              <SheetChoice testid="add-reimbursement-choice" onClick={() => goto("/reimburse/add")}
                color="amber" icon={<HandHelping size={20} />}
                title="Reimburse Member" sub="Pay back money a member spent personally" />
              <SheetChoice testid="add-expense-choice" onClick={() => goto("/expenses/add")}
                color="red" icon={<Receipt size={20} />}
                title="Expense / Bill" sub="Payment made to a vendor" />
              <NavLink to="/reports" onClick={() => setAddOpen(false)} data-testid="add-reports-link"
                className="md:hidden w-full h-12 rounded-xl border border-slate-300 flex items-center justify-center gap-2 text-slate-700 font-medium hover:bg-slate-50">
                <FileDown size={16} /> Open Reports / Export
              </NavLink>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-5xl mx-auto px-2 py-1.5 grid grid-cols-5">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} data-testid={t.testid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-colors ${
                  isActive ? "text-teal-700 bg-teal-50" : "text-slate-500 hover:text-slate-800"
                }`
              }>
              <t.icon size={20} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function SheetChoice({ testid, onClick, color, icon, title, sub }) {
  const styles = {
    emerald: { bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", ic: "bg-emerald-600", text: "text-emerald-900", tsub: "text-emerald-700" },
    teal: { bg: "bg-teal-50 hover:bg-teal-100 border-teal-200", ic: "bg-teal-600", text: "text-teal-900", tsub: "text-teal-700" },
    red: { bg: "bg-red-50 hover:bg-red-100 border-red-200", ic: "bg-red-600", text: "text-red-900", tsub: "text-red-700" },
    amber: { bg: "bg-amber-50 hover:bg-amber-100 border-amber-200", ic: "bg-amber-600", text: "text-amber-900", tsub: "text-amber-700" },
  }[color];
  return (
    <button onClick={onClick} data-testid={testid}
      className={`w-full min-h-14 rounded-2xl ${styles.bg} flex items-center gap-3 px-4 py-3 text-left border transition-colors`}>
      <div className={`w-10 h-10 rounded-xl ${styles.ic} text-white flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className={`font-semibold ${styles.text}`}>{title}</div>
        <div className={`text-xs ${styles.tsub}`}>{sub}</div>
      </div>
    </button>
  );
}

function YearOption({ label, value, active, onSelect, testid }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={testid}
      className={`w-full h-12 px-4 rounded-xl flex items-center justify-between border transition-colors ${
        active ? "bg-teal-50 border-teal-500 text-teal-900" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
      }`}
    >
      <span className="font-semibold tabular-nums">{label}</span>
      {active && <Check size={18} className="text-teal-600" />}
    </button>
  );
}
