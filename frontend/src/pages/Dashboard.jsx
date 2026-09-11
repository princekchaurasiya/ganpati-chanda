import React, { useEffect, useState } from "react";
import { dashboardApi, chandaApi, backupApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, IndianRupee, Users, Wallet, Sparkles, Scale, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

const modeColors = {
  Cash: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  UPI: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "Bank Transfer": { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  Other: { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([dashboardApi.get(), chandaApi.list()]);
      setStats(s);
      setRecent(list.filter((x) => !x.voided).slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await backupApi.seed();
      } catch (_e) { /* seed idempotent */ }
      load();
    })();
  }, []);

  if (loading) {
    return (
      <div className="pt-10 text-center text-slate-500" data-testid="dashboard-loading">
        Loading…
      </div>
    );
  }

  const pct = stats.total_expected > 0 ? Math.round((stats.total_collected / stats.total_expected) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      {/* KPI Hero */}
      <div className="card-elevated p-5 sm:p-6" data-testid="dashboard-hero-card">
        <div className="text-sm text-slate-500 font-medium">कुल संग्रह (Total Collected)</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-4xl sm:text-5xl font-extrabold text-emerald-700 font-num tracking-tight" data-testid="stat-total-collected">
            {formatINR(stats.total_collected)}
          </div>
          <div className="text-sm text-slate-500 font-num">/ {formatINR(stats.total_expected)}</div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-xs text-slate-500">{pct}% of expected collected</div>
      </div>

      {/* Balance card */}
      <div className={`card-elevated p-5 ${stats.balance >= 0 ? "bg-gradient-to-br from-teal-50 to-emerald-50" : "bg-gradient-to-br from-orange-50 to-red-50"}`} data-testid="dashboard-balance-card">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Scale size={16} /> Remaining Balance
        </div>
        <div className={`mt-1 text-3xl sm:text-4xl font-extrabold font-num tracking-tight ${stats.balance >= 0 ? "text-teal-800" : "text-red-700"}`} data-testid="stat-balance">
          {formatINR(stats.balance)}
        </div>
        <div className="mt-1 text-xs text-slate-600 font-num">
          Chanda {formatINR(stats.total_collected)} − Expenses {formatINR(stats.total_expenses || 0)}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          testid="stat-pending-card"
          icon={<TrendingDown size={18} />}
          label="Pending"
          value={formatINR(stats.total_pending)}
          sub={`${stats.count_pending} entries`}
          color="orange"
        />
        <StatCard
          testid="stat-expenses-card"
          icon={<Receipt size={18} />}
          label="Total Expenses"
          value={formatINR(stats.total_expenses || 0)}
          sub={`${stats.count_expenses || 0} entries`}
          color="red"
        />
      </div>

      {/* By Payment Mode */}
      <section className="card-elevated p-5" data-testid="dashboard-mode-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Wallet size={18} className="text-teal-600" /> Payment Mode
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["Cash", "UPI", "Bank Transfer", "Other"].map((m) => {
            const val = stats.by_payment_mode?.[m] || 0;
            const c = modeColors[m];
            return (
              <div key={m} className={`${c.bg} rounded-xl px-3 py-2.5 flex flex-col`} data-testid={`mode-tile-${m.replace(/\s/g,'-').toLowerCase()}`}>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {m}
                </div>
                <div className={`text-lg font-bold font-num ${c.text}`}>{formatINR(val)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* By Collector */}
      <section className="card-elevated p-5" data-testid="dashboard-collectors-section">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Users size={18} className="text-teal-600" /> Collector-wise (Kisko Diya)
        </h2>
        {Object.keys(stats.by_collector || {}).length === 0 ? (
          <div className="text-sm text-slate-500">No collections yet.</div>
        ) : (
          <div className="space-y-2">
            {Object.entries(stats.by_collector)
              .sort((a, b) => b[1] - a[1])
              .map(([name, amt]) => {
                const share = stats.total_collected > 0 ? (amt / stats.total_collected) * 100 : 0;
                return (
                  <div key={name} data-testid={`collector-row-${name.replace(/\s/g,'-')}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{name}</span>
                      <span className="font-num font-bold text-slate-900">{formatINR(amt)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-teal-500" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* Recent */}
      <section className="card-elevated p-5" data-testid="dashboard-recent-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles size={18} className="text-teal-600" /> Recent Entries
          </h2>
          <Link to="/list" className="text-sm font-medium text-teal-700" data-testid="view-all-link">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-sm text-slate-500">No entries yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between" data-testid={`recent-row-${r.id}`}>
                <div>
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.collector} · {r.payment_mode} · {formatDate(r.date)}</div>
                </div>
                <div className="text-right">
                  <div className="font-num font-bold text-slate-900">{formatINR(r.amount)}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.status === "Collected" ? "status-collected" : "status-pending"}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, testid }) {
  const map = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ic: "bg-emerald-100 text-emerald-700" },
    orange: { bg: "bg-orange-50", text: "text-orange-700", ic: "bg-orange-100 text-orange-700" },
    red: { bg: "bg-red-50", text: "text-red-700", ic: "bg-red-100 text-red-700" },
  };
  const c = map[color] || map.emerald;
  return (
    <div className={`card-elevated p-4`} data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.ic}`}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-extrabold font-num ${c.text}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
