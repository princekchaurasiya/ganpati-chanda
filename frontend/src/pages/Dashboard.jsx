import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, chandaApi, backupApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Users, Wallet, Sparkles, Scale, Receipt, HandCoins, ArrowRightLeft, ChevronRight } from "lucide-react";

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
      try { await backupApi.seed(); } catch (_e) { /* idempotent */ }
      load();
    })();
  }, []);

  if (loading || !stats) {
    return <div className="pt-10 text-center text-slate-500" data-testid="dashboard-loading">Loading…</div>;
  }

  const ch = stats.chanda;
  const ex = stats.expenses;
  const mp = stats.money_position;
  const members = stats.members || [];
  const receivedPct = ch.total_promised > 0 ? Math.round((ch.total_received / ch.total_promised) * 100) : 0;
  const paidPct = ex.total_bill > 0 ? Math.round((ex.total_paid / ex.total_bill) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      {/* Balance Hero */}
      <div className={`card-elevated p-5 sm:p-6 ${stats.balance >= 0 ? "bg-gradient-to-br from-teal-50 via-white to-emerald-50" : "bg-gradient-to-br from-orange-50 via-white to-red-50"}`} data-testid="dashboard-balance-card">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Scale size={16} /> Remaining Balance (Available Cash)
        </div>
        <div className={`mt-1 text-4xl sm:text-5xl font-extrabold font-num tracking-tight ${stats.balance >= 0 ? "text-teal-800" : "text-red-700"}`} data-testid="stat-balance">
          {formatINR(stats.balance)}
        </div>
        <div className="mt-1 text-xs text-slate-600 font-num">
          Received {formatINR(ch.total_received)} − Paid {formatINR(ex.total_paid)}
        </div>
      </div>

      {/* Chanda Section */}
      <section className="card-elevated p-5" data-testid="chanda-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <HandCoins size={16} className="text-emerald-700" /> Chanda
          </h2>
          <Link to="/list" className="text-xs font-medium text-teal-700" data-testid="chanda-view-link">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniStat testid="stat-promised" label="Promised" value={formatINR(ch.total_promised)} color="slate" to="/list" />
          <MiniStat testid="stat-received" label="Received" value={formatINR(ch.total_received)} color="emerald" to="/list?status=Collected" />
          <MiniStat testid="stat-pending" label="Pending" value={formatINR(ch.total_pending)} color="orange" to="/list?status=Pending" />
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${receivedPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{receivedPct}% received · {ch.count_collected} collected, {ch.count_pending} pending</div>
      </section>

      {/* Expenses Section */}
      <section className="card-elevated p-5" data-testid="expenses-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Receipt size={16} className="text-red-700" /> Expenses / Bills
          </h2>
          <Link to="/expenses" className="text-xs font-medium text-teal-700" data-testid="expenses-view-link">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniStat testid="stat-bill" label="Total Bill" value={formatINR(ex.total_bill)} color="slate" to="/expenses" />
          <MiniStat testid="stat-paid" label="Paid" value={formatINR(ex.total_paid)} color="red" to="/expenses" />
          <MiniStat testid="stat-payable" label="Payable" value={formatINR(ex.total_payable)} color="orange" to="/expenses" />
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{paidPct}% paid to vendors · {ex.count} bill{ex.count === 1 ? "" : "s"}</div>
      </section>

      {/* Money Position */}
      <section className="card-elevated p-5" data-testid="money-position-section">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-teal-700" /> Money Position
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat testid="stat-cash-held" label="Cash Held by Members" value={formatINR(mp.cash_held)} color="teal" to="/members" />
          <MiniStat testid="stat-paid-total" label="Paid Toward Expenses" value={formatINR(mp.total_paid_to_expenses)} color="red" to="/expenses" />
        </div>
      </section>

      {/* Member-wise Summary */}
      <section className="card-elevated p-5" data-testid="members-summary-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Users size={16} className="text-teal-700" /> Member-wise Summary
          </h2>
          <Link to="/members" className="text-xs font-medium text-teal-700" data-testid="members-view-link">Details →</Link>
        </div>
        {members.length === 0 ? (
          <div className="text-sm text-slate-500">No member activity yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs sm:text-sm" data-testid="members-table">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2 font-semibold">Member</th>
                  <th className="py-2 px-2 font-semibold text-right font-num">Collected</th>
                  <th className="py-2 px-2 font-semibold text-right font-num">Trf</th>
                  <th className="py-2 px-2 font-semibold text-right font-num">Paid</th>
                  <th className="py-2 pl-2 font-semibold text-right font-num">Held</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.name} className="border-b border-slate-50 last:border-0" data-testid={`member-row-${m.name}`}>
                    <td className="py-2 pr-2">
                      <Link to={`/members/${encodeURIComponent(m.name)}`} className="font-medium text-slate-900 hover:text-teal-700">{m.name}</Link>
                    </td>
                    <td className="py-2 px-2 text-right font-num text-slate-900">{formatINR(m.total_received)}</td>
                    <td className="py-2 px-2 text-right font-num text-slate-600">
                      {m.transferred_out > 0 && <span className="text-orange-700">-{formatINR(m.transferred_out)}</span>}
                      {m.transferred_in > 0 && <span className="text-blue-700"> +{formatINR(m.transferred_in)}</span>}
                      {(m.transferred_out === 0 && m.transferred_in === 0) && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-num text-red-700">{m.paid_to_expenses > 0 ? formatINR(m.paid_to_expenses) : "—"}</td>
                    <td className={`py-2 pl-2 text-right font-num font-bold ${m.current_held < -0.01 ? "text-red-700" : m.current_held < 0.01 ? "text-slate-500" : "text-emerald-700"}`}>
                      {formatINR(m.current_held)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Member Advances / Reimbursements */}
      {(stats.reimbursements.total_personal_contribution > 0 || stats.reimbursements.total_reimbursed > 0) && (
        <section className="card-elevated p-5" data-testid="advances-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <HandCoins size={16} className="text-amber-700" /> Member Advances / Reimbursements
            </h2>
            {stats.reimbursements.outstanding > 0.01 && (
              <Link to="/reimburse/add" className="text-xs font-semibold text-teal-700" data-testid="dashboard-reimburse-link">Reimburse →</Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniStat testid="stat-personal-contribution" label="Personal Contribution" value={formatINR(stats.reimbursements.total_personal_contribution)} color="amber" to="/members" />
            <MiniStat testid="stat-reimbursed" label="Reimbursed" value={formatINR(stats.reimbursements.total_reimbursed)} color="emerald" to="/members" />
            <MiniStat testid="stat-reimb-outstanding" label="Outstanding" value={formatINR(stats.reimbursements.outstanding)} color={stats.reimbursements.outstanding > 0.01 ? "red" : "slate"} to={stats.reimbursements.outstanding > 0.01 ? "/reimburse/add" : "/members"} />
          </div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs sm:text-sm" data-testid="advances-table">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2 font-semibold">Member</th>
                  <th className="py-2 px-2 font-semibold text-right font-num">Personal</th>
                  <th className="py-2 px-2 font-semibold text-right font-num">Reimbursed</th>
                  <th className="py-2 pl-2 font-semibold text-right font-num">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {members.filter((m) => m.personal_contribution > 0 || m.reimbursement_received > 0).map((m) => (
                  <tr key={m.name} className="border-b border-slate-50 last:border-0" data-testid={`advance-row-${m.name}`}>
                    <td className="py-2 pr-2 font-medium text-slate-900">{m.name}</td>
                    <td className="py-2 px-2 text-right font-num text-amber-700">{formatINR(m.personal_contribution)}</td>
                    <td className="py-2 px-2 text-right font-num text-emerald-700">{formatINR(m.reimbursement_received)}</td>
                    <td className={`py-2 pl-2 text-right font-num font-bold ${m.reimbursement_due > 0.01 ? "text-red-700" : "text-slate-500"}`}>
                      {formatINR(m.reimbursement_due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Payment Mode */}
      <section className="card-elevated p-5" data-testid="dashboard-mode-section">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-teal-700" /> Payment Mode (Received)
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {["Cash", "UPI", "Bank Transfer", "Other"].map((m) => {
            const val = ch.by_payment_mode?.[m] || 0;
            const c = modeColors[m];
            return (
              <div key={m} className={`${c.bg} rounded-xl px-3 py-2.5 flex flex-col`} data-testid={`mode-tile-${m.replace(/\s/g, '-').toLowerCase()}`}>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {m}
                </div>
                <div className={`text-lg font-bold font-num ${c.text}`}>{formatINR(val)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent */}
      <section className="card-elevated p-5" data-testid="dashboard-recent-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-teal-700" /> Recent Chanda
          </h2>
          <Link to="/list" className="text-xs font-medium text-teal-700" data-testid="view-all-link">View all →</Link>
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
                  <div className="font-num font-bold text-slate-900">{formatINR(r.received_amount || r.amount)}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.status === "Collected" ? "status-collected" : "status-pending"}`}>
                    {r.status}
                    {r.status === "Pending" ? ` · promise ${formatINR(r.amount)}` : ""}
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

function MiniStat({ label, value, sub, color, testid, to }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  };
  const base = `rounded-xl p-2.5 ${map[color] || map.slate}`;
  const body = (
    <>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
        {to && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
      </div>
      <div className="text-base sm:text-lg font-extrabold font-num mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </>
  );
  if (to) {
    return (
      <Link to={to} data-testid={testid} className={`${base} block hover:brightness-95 active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400`}>
        {body}
      </Link>
    );
  }
  return <div className={base} data-testid={testid}>{body}</div>;
}
