import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardApi, chandaApi, expenseApi, reimbursementApi, backupApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { TrendingDown, Users, Wallet, Sparkles, Scale, Receipt, HandCoins, ChevronRight, X, CheckCircle2, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const modeColors = {
  Cash: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  UPI: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "Bank Transfer": { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  Other: { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" },
};

const shortReceipt = (e) => {
  if (!e.receipt_no) return null;
  const p = (e.receipt_book_name || "").replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "B";
  return `${p}/${String(e.receipt_no).padStart(3, "0")}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chandas, setChandas] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [reimbs, setReimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalKind, setModalKind] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, cList, eList, rList] = await Promise.all([
        dashboardApi.get(), chandaApi.list(), expenseApi.list(), reimbursementApi.list(),
      ]);
      setStats(s);
      setChandas(cList);
      setExpenses(eList);
      setReimbs(rList);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => { try { await backupApi.seed(); } catch (_e) {} load(); })();
  }, []);

  if (loading || !stats) {
    return <div className="pt-10 text-center text-slate-500" data-testid="dashboard-loading">Loading…</div>;
  }

  const ch = stats.chanda;
  const ex = stats.expenses;
  const mp = stats.money_position;
  const members = stats.members || [];
  const recent = chandas.filter((x) => !x.voided).slice(0, 5);
  const receivedPct = ch.total_promised > 0 ? Math.round((ch.total_received / ch.total_promised) * 100) : 0;
  const paidPct = ex.total_bill > 0 ? Math.round((ex.total_paid / ex.total_bill) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      <button type="button" onClick={() => setModalKind("balance-tally")}
        data-testid="dashboard-balance-card"
        className={`card-elevated p-5 sm:p-6 text-left w-full hover:brightness-95 active:scale-[0.995] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400 ${stats.balance >= 0 ? "bg-gradient-to-br from-teal-50 via-white to-emerald-50" : "bg-gradient-to-br from-orange-50 via-white to-red-50"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Scale size={16} /> Remaining Balance (Available Cash)
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </div>
        <div className={`mt-1 text-4xl sm:text-5xl font-extrabold font-num tracking-tight ${stats.balance >= 0 ? "text-teal-800" : "text-red-700"}`} data-testid="stat-balance">
          {formatINR(stats.balance)}
        </div>
        <div className="mt-1 text-xs text-slate-600 font-num">
          Received {formatINR(ch.total_received)} − Group Paid {formatINR(mp.total_paid_to_expenses_group)} · <span className="text-teal-700 font-medium">tap to tally</span>
        </div>
      </button>

      <section className="card-elevated p-5" data-testid="chanda-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <HandCoins size={16} className="text-emerald-700" /> Chanda
          </h2>
          <Link to="/list" className="text-xs font-medium text-teal-700" data-testid="chanda-view-link">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniStat testid="stat-promised" label="Promised" value={formatINR(ch.total_promised)} color="slate" onClick={() => setModalKind("chanda-all")} />
          <MiniStat testid="stat-received" label="Received" value={formatINR(ch.total_received)} color="emerald" onClick={() => setModalKind("chanda-collected")} />
          <MiniStat testid="stat-pending" label="Pending" value={formatINR(ch.total_pending)} color="orange" onClick={() => setModalKind("chanda-pending")} />
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${receivedPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{receivedPct}% received · {ch.count_collected} collected, {ch.count_pending} pending</div>
      </section>

      <section className="card-elevated p-5" data-testid="expenses-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Receipt size={16} className="text-red-700" /> Expenses / Bills
          </h2>
          <Link to="/expenses" className="text-xs font-medium text-teal-700" data-testid="expenses-view-link">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniStat testid="stat-bill" label="Total Bill" value={formatINR(ex.total_bill)} color="slate" onClick={() => setModalKind("expenses-all")} />
          <MiniStat testid="stat-paid" label="Paid" value={formatINR(ex.total_paid)} color="red" onClick={() => setModalKind("expenses-all")} />
          <MiniStat testid="stat-payable" label="Payable" value={formatINR(ex.total_payable)} color="orange" onClick={() => setModalKind("expenses-payable")} />
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{paidPct}% paid to vendors · {ex.count} bill{ex.count === 1 ? "" : "s"}</div>
      </section>

      <section className="card-elevated p-5" data-testid="money-position-section">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-teal-700" /> Money Position
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat testid="stat-cash-held" label="Cash Held by Members" value={formatINR(mp.cash_held)} color="teal" onClick={() => setModalKind("members-cash")} />
          <MiniStat testid="stat-paid-total" label="Paid Toward Expenses" value={formatINR(mp.total_paid_to_expenses)} color="red" onClick={() => setModalKind("expenses-all")} />
        </div>
      </section>

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
                  <tr key={m.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer active:bg-slate-100" data-testid={`member-row-${m.name}`} onClick={() => setModalKind(`member:${m.name}`)}>
                    <td className="py-2 pr-2">
                      <span className="font-medium text-slate-900">{m.name}</span>
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
          <div className="grid grid-cols-3 gap-2">
            <MiniStat testid="stat-personal-contribution" label="Personal Contribution" value={formatINR(stats.reimbursements.total_personal_contribution)} color="amber" onClick={() => setModalKind("advances-personal")} />
            <MiniStat testid="stat-reimbursed" label="Reimbursed" value={formatINR(stats.reimbursements.total_reimbursed)} color="emerald" onClick={() => setModalKind("advances-reimbursed")} />
            <MiniStat testid="stat-reimb-outstanding" label="Outstanding" value={formatINR(stats.reimbursements.outstanding)} color={stats.reimbursements.outstanding > 0.01 ? "red" : "slate"} onClick={() => setModalKind("advances-outstanding")} />
          </div>
        </section>
      )}

      <section className="card-elevated p-5" data-testid="dashboard-mode-section">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-teal-700" /> Payment Mode (Received)
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {["Cash", "UPI", "Bank Transfer", "Other"].map((m) => {
            const val = ch.by_payment_mode?.[m] || 0;
            const c = modeColors[m];
            return (
              <button type="button" key={m} onClick={() => setModalKind(`mode:${m}`)}
                className={`${c.bg} rounded-xl px-3 py-2.5 flex flex-col text-left hover:brightness-95 active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400`}
                data-testid={`mode-tile-${m.replace(/\s/g, '-').toLowerCase()}`}>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {m}
                  </div>
                  <ChevronRight size={12} className="text-slate-400 shrink-0" />
                </div>
                <div className={`text-lg font-bold font-num ${c.text}`}>{formatINR(val)}</div>
              </button>
            );
          })}
        </div>
      </section>

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
            {recent.map((r) => {
              const rc = shortReceipt(r);
              return (
                <div key={r.id} className="py-2.5 flex items-center gap-2" data-testid={`recent-row-${r.id}`}>
                  {rc && (
                    <div className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" data-testid={`recent-receipt-${r.id}`} title={`${r.receipt_book_name || ""} · #${r.receipt_no}`}>
                      {rc}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{r.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {r.receipt_book_name ? <span className="text-teal-700 font-medium">{r.receipt_book_name} #{r.receipt_no} · </span> : null}
                      {r.collector} · {r.payment_mode} · {formatDate(r.date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-num font-bold text-slate-900">{formatINR(r.received_amount || r.amount)}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.status === "Collected" ? "status-collected" : "status-pending"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalKind && (
        <StatModal
          kind={modalKind}
          onClose={() => setModalKind(null)}
          switchKind={setModalKind}
          chandas={chandas}
          expenses={expenses}
          reimbs={reimbs}
          members={members}
          reload={load}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, color, testid, onClick }) {
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
        {onClick && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
      </div>
      <div className="text-base sm:text-lg font-extrabold font-num mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testid}
        className={`${base} block w-full text-left hover:brightness-95 active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400`}>
        {body}
      </button>
    );
  }
  return <div className={base} data-testid={testid}>{body}</div>;
}

function StatModal({ kind, onClose, switchKind, chandas, expenses, reimbs, members, reload }) {
  const nav = useNavigate();
  const active = chandas.filter((c) => !c.voided);
  const activeExp = expenses.filter((e) => !e.voided);
  const activeReimb = reimbs.filter((r) => !r.voided);
  const goEditChanda = (e) => { onClose(); nav("/add", { state: { entry: e } }); };

  let conf = {
    "chanda-all": { title: "All Chanda", body: () => <ChandaRows entries={active} onEdit={goEditChanda} reload={reload} />, deepLink: "/list" },
    "chanda-collected": { title: "Received Chanda", body: () => <ChandaRows entries={active.filter((c) => c.status === "Collected")} onEdit={goEditChanda} reload={reload} />, deepLink: "/list?status=Collected" },
    "chanda-pending": { title: "Pending Chanda", body: () => <ChandaRows entries={active.filter((c) => c.status === "Pending")} onEdit={goEditChanda} reload={reload} showReceive />, deepLink: "/list?status=Pending" },
    "expenses-all": { title: "All Expenses", body: () => <ExpenseRows entries={activeExp} onEdit={(e) => { onClose(); nav("/expenses/add", { state: { entry: e } }); }} />, deepLink: "/expenses" },
    "expenses-payable": { title: "Payable Bills", body: () => <ExpenseRows entries={activeExp.filter((e) => (e.total_bill - e.amount_paid) > 0.01)} onEdit={(e) => { onClose(); nav("/expenses/add", { state: { entry: e } }); }} />, deepLink: "/expenses" },
    "members-cash": {
      title: "Cash Held by Members",
      body: () => {
        const heldMembers = members.filter((m) => Math.abs(m.current_held) > 0.01);
        const pos = heldMembers.filter((m) => m.current_held > 0).reduce((s, m) => s + m.current_held, 0);
        const neg = heldMembers.filter((m) => m.current_held < 0).reduce((s, m) => s + m.current_held, 0);
        const net = pos + neg;
        return (
          <div>
            <div className="mx-2 my-2 rounded-xl bg-slate-50 p-3 text-xs" data-testid="members-cash-summary">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Members holding cash</span>
                <span className="font-num font-bold text-emerald-700">+{formatINR(pos)}</span>
              </div>
              {neg < -0.01 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-600">Group owes (negative held)</span>
                  <span className="font-num font-bold text-red-700">{formatINR(neg)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                <span className="text-slate-800 font-semibold">Net cash with members</span>
                <span className={`font-num font-extrabold ${net >= 0 ? "text-teal-800" : "text-red-800"}`}>{formatINR(net)}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Should match Balance tile</div>
            </div>
            <MemberRows
              members={heldMembers.sort((a, b) => b.current_held - a.current_held)}
              onOpen={(m) => { onClose(); nav(`/members/${encodeURIComponent(m.name)}`); }}
              field="current_held"
            />
          </div>
        );
      },
      deepLink: "/members",
    },
    "advances-personal": { title: "Personal Contributions", body: () => <MemberRows members={members.filter((m) => m.personal_contribution > 0.01)} onOpen={(m) => { onClose(); nav(`/members/${encodeURIComponent(m.name)}`); }} field="personal_contribution" />, deepLink: "/members" },
    "advances-reimbursed": { title: "Reimbursements Paid", body: () => <ReimbRows entries={activeReimb} />, deepLink: "/members" },
    "advances-outstanding": { title: "Reimbursement Outstanding", body: () => <MemberRows members={members.filter((m) => m.reimbursement_due > 0.01)} onOpen={(m) => { onClose(); nav("/reimburse/add", { state: { to_member: m.name, amount: m.reimbursement_due } }); }} field="reimbursement_due" cta="Reimburse" />, deepLink: "/reimburse/add" },
  }[kind];

  if (!conf && kind && kind.startsWith("mode:")) {
    const mode = kind.slice(5);
    const filtered = active.filter((c) => c.payment_mode === mode && c.status === "Collected");
    const total = filtered.reduce((s, c) => s + (c.received_amount || c.amount || 0), 0);
    conf = {
      title: `${mode} Received`,
      body: () => (
        <div>
          <div className="px-3 pb-2 pt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</span>
            <span className="font-num font-bold text-slate-900">{formatINR(total)}</span>
          </div>
          <ChandaRows entries={filtered} onEdit={goEditChanda} reload={reload} />
        </div>
      ),
      deepLink: `/list?mode=${encodeURIComponent(mode)}&status=Collected`,
    };
  }

  if (!conf && kind && kind.startsWith("member:")) {
    const name = kind.slice(7);
    const mem = members.find((m) => m.name === name);
    const mine = active.filter((c) => c.collector === name);
    const collected = mine.filter((c) => c.status === "Collected");
    const pending = mine.filter((c) => c.status === "Pending");
    const collectedTotal = collected.reduce((s, c) => s + (c.received_amount || c.amount || 0), 0);
    const pendingTotal = pending.reduce((s, c) => s + (c.amount || 0), 0);
    conf = {
      title: `${name} — Details`,
      body: () => (
        <div>
          {mem && (
            <div className="mx-2 mb-2 rounded-xl bg-slate-50 p-3 grid grid-cols-2 gap-2 text-xs" data-testid={`member-modal-summary-${name}`}>
              <SumCell label="Collected" value={formatINR(mem.total_received)} tone="emerald" />
              <SumCell label="Cash Held" value={formatINR(mem.current_held)} tone={mem.current_held < -0.01 ? "red" : mem.current_held > 0.01 ? "teal" : "slate"} />
              <SumCell label="Paid to Expenses" value={formatINR(mem.paid_to_expenses)} tone="red" />
              <SumCell label="Transfers" value={`${mem.transferred_out > 0 ? "-" + formatINR(mem.transferred_out) : ""}${mem.transferred_out > 0 && mem.transferred_in > 0 ? " / " : ""}${mem.transferred_in > 0 ? "+" + formatINR(mem.transferred_in) : ""}${mem.transferred_in === 0 && mem.transferred_out === 0 ? "—" : ""}`} tone="slate" />
              {(mem.personal_contribution > 0.01 || mem.reimbursement_due > 0.01) && (
                <>
                  <SumCell label="Personal Contrib" value={formatINR(mem.personal_contribution)} tone="amber" />
                  <SumCell label="Reimb Due" value={formatINR(mem.reimbursement_due)} tone={mem.reimbursement_due > 0.01 ? "red" : "slate"} />
                </>
              )}
            </div>
          )}
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Collected · {formatINR(collectedTotal)}
          </div>
          <ChandaRows entries={collected} onEdit={goEditChanda} reload={reload} />
          {pending.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Pending · {formatINR(pendingTotal)}
              </div>
              <ChandaRows entries={pending} onEdit={goEditChanda} reload={reload} showReceive />
            </>
          )}
          {mine.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">No chanda collected by {name} yet.</div>}
        </div>
      ),
      deepLink: `/members/${encodeURIComponent(name)}`,
    };
  }

  if (!conf && kind === "balance-tally") {
    // Aggregate income: chanda received grouped by payment mode
    const received = active.filter((c) => c.status === "Collected");
    const receivedTotal = received.reduce((s, c) => s + (c.received_amount || c.amount || 0), 0);
    const paidTotal = activeExp.reduce((s, e) => s + (e.group_funds_used || 0), 0);
    const personalTotal = activeExp.reduce((s, e) => s + (e.personal_contribution || 0), 0);
    const billTotal = activeExp.reduce((s, e) => s + (e.total_bill || 0), 0);
    const balance = receivedTotal - paidTotal;
    const pendingChanda = active.filter((c) => c.status === "Pending").reduce((s, c) => s + (c.amount || 0), 0);
    const payable = billTotal - activeExp.reduce((s, e) => s + (e.amount_paid || 0), 0);
    const heldMembers = members.filter((m) => Math.abs(m.current_held) > 0.01);
    const posHeld = heldMembers.filter((m) => m.current_held > 0).reduce((s, m) => s + m.current_held, 0);
    const negHeld = heldMembers.filter((m) => m.current_held < 0).reduce((s, m) => s + m.current_held, 0);

    const byMode = {};
    received.forEach((c) => {
      const k = c.payment_mode || "-";
      if (!byMode[k]) byMode[k] = { count: 0, total: 0 };
      byMode[k].count += 1;
      byMode[k].total += c.received_amount || c.amount || 0;
    });
    const byCat = {};
    activeExp.forEach((e) => {
      const k = e.category || "Other";
      if (!byCat[k]) byCat[k] = { count: 0, total: 0 };
      byCat[k].count += 1;
      byCat[k].total += e.amount_paid || 0;
    });

    conf = {
      title: "Balance Tally (Kaha se Kaha)",
      body: () => (
        <div className="space-y-3 p-1">
          <div className={`rounded-xl p-4 ${balance >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`} data-testid="tally-formula">
            <div className="text-xs text-slate-600 font-medium mb-1">Formula</div>
            <div className="font-num text-sm">
              <span className="text-emerald-700 font-bold">{formatINR(receivedTotal)}</span>
              <span className="text-slate-500"> (Received)</span>
              <span className="mx-1">−</span>
              <span className="text-red-700 font-bold">{formatINR(paidTotal)}</span>
              <span className="text-slate-500"> (Group Paid)</span>
              <span className="mx-1">=</span>
              <span className={`font-extrabold text-lg ${balance >= 0 ? "text-emerald-800" : "text-red-800"}`}>{formatINR(balance)}</span>
            </div>
            {personalTotal > 0.01 && (
              <div className="text-[11px] text-amber-700 mt-1">
                Note: Rs.{Math.round(personalTotal)} personal cash bhi lagi (group owes members — separate reimbursement due, group balance me count nahi hoti)
              </div>
            )}
          </div>

          <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-emerald-100">
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Income (Received chanda)</div>
              <div className="font-num font-bold text-emerald-700">+{formatINR(receivedTotal)}</div>
            </div>
            <div className="divide-y divide-emerald-100/70">
              {Object.entries(byMode).sort((a, b) => b[1].total - a[1].total).map(([m, d]) => (
                <button key={m} type="button" onClick={() => switchKind && switchKind(`mode:${m}`)}
                  data-testid={`tally-income-${m.replace(/\s/g,'-').toLowerCase()}`}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-emerald-100/50 text-left">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-slate-800 flex-1 truncate">{m}</span>
                  <span className="text-[11px] text-slate-500">{d.count}</span>
                  <span className="font-num font-bold text-emerald-700">+{formatINR(d.total)}</span>
                  <ChevronRight size={13} className="text-slate-400" />
                </button>
              ))}
            </div>
            {pendingChanda > 0.01 && (
              <button type="button" onClick={() => switchKind && switchKind("chanda-pending")}
                data-testid="tally-income-pending"
                className="w-full px-3 py-1.5 bg-amber-50 text-[11px] text-amber-800 border-t border-emerald-100 flex items-center justify-between hover:bg-amber-100">
                <span>+ Pending (abhi tak nahi mila) — tap</span>
                <span className="font-num font-bold">{formatINR(pendingChanda)}</span>
              </button>
            )}
          </div>

          <div className="rounded-xl bg-red-50/60 border border-red-100 overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-red-100">
              <div className="text-xs font-semibold text-red-800 uppercase tracking-wide">Expenses (Group cash paid)</div>
              <div className="font-num font-bold text-red-700">-{formatINR(paidTotal)}</div>
            </div>
            <div className="divide-y divide-red-100/70">
              {Object.entries(byCat).sort((a, b) => b[1].total - a[1].total).map(([c, d]) => (
                <button key={c} type="button"
                  onClick={() => { onClose(); nav("/expenses", { state: { initialCat: c } }); }}
                  data-testid={`tally-cat-${c.replace(/\s/g,'-').toLowerCase()}`}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-100/50 text-left">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-slate-800 flex-1 truncate">{c}</span>
                  <span className="text-[11px] text-slate-500">{d.count}</span>
                  <span className="font-num font-bold text-red-700">-{formatINR(d.total)}</span>
                  <ChevronRight size={13} className="text-slate-400" />
                </button>
              ))}
            </div>
            {payable > 0.01 && (
              <button type="button"
                onClick={() => { onClose(); nav("/expenses"); }}
                data-testid="tally-payable"
                className="w-full px-3 py-1.5 bg-amber-50 text-[11px] text-amber-800 border-t border-red-100 flex items-center justify-between hover:bg-amber-100">
                <span>+ Bakaya bills (abhi tak nahi diya) — tap</span>
                <span className="font-num font-bold">{formatINR(payable)}</span>
              </button>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Ye ₹{Math.round(balance)} kis-kis ke paas hai?</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Balance = jitna paisa members ke paas physically hai (+ve me hai) minus jitna group unhe wapas dena hai (-ve me hai)</div>
            </div>
            <div className="divide-y divide-slate-100">
              {heldMembers.sort((a, b) => b.current_held - a.current_held).map((m) => (
                <button key={m.name} type="button"
                  onClick={() => switchKind && switchKind(`member:${m.name}`)}
                  data-testid={`tally-held-${m.name}`}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-100 text-left">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${m.current_held < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {m.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{m.name}</div>
                    {m.current_held < 0 && <div className="text-[10px] text-red-600">group ko wapas dena hai</div>}
                  </div>
                  <span className={`font-num font-bold ${m.current_held < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {m.current_held >= 0 ? "+" : ""}{formatINR(m.current_held)}
                  </span>
                  <ChevronRight size={13} className="text-slate-400" />
                </button>
              ))}
            </div>
            <div className="px-3 py-2 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-700 font-semibold">Net (Positive − Negative)</span>
              <span className="font-num font-extrabold text-teal-800">+{formatINR(posHeld)} {negHeld < -0.01 ? `− ${formatINR(-negHeld)}` : ""} = {formatINR(posHeld + negHeld)}</span>
            </div>
          </div>

          <div className={`rounded-xl p-3 flex items-center justify-between ${balance >= 0 ? "bg-teal-600" : "bg-red-600"} text-white`}>
            <div className="text-sm font-medium">Available Cash (Balance)</div>
            <div className="font-num text-xl font-extrabold" data-testid="tally-balance">{formatINR(balance)}</div>
          </div>

          <div className="text-[10px] text-slate-500 text-center px-2">
            Note: In-group transfers (member↔member) don't change the group's total balance — they just move cash between members.
          </div>
        </div>
      ),
      deepLink: "/expenses",
    };
  }

  if (!conf) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose} data-testid="stat-modal">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate" data-testid="stat-modal-title">{conf.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link to={conf.deepLink} onClick={onClose} data-testid="stat-modal-open-full"
              className="h-8 px-2 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center gap-1 text-xs font-medium">
              <ExternalLink size={13} /> Open
            </Link>
            <button onClick={onClose} data-testid="stat-modal-close"
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2" data-testid="stat-modal-body">
          {conf.body()}
        </div>
      </div>
    </div>
  );
}

function ChandaRows({ entries, onEdit, reload, showReceive }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No entries.</div>;
  const markReceived = async (e) => {
    try { await chandaApi.markReceived(e.id); toast.success("Marked Received"); reload(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((e) => {
        const r = shortReceipt(e);
        return (
          <div key={e.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-chanda-${e.id}`}>
            {r && <div className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" data-testid={`modal-receipt-${e.id}`} title={`${e.receipt_book_name || ""} · #${e.receipt_no}`}>{r}</div>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{e.name}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {e.receipt_book_name ? <span className="text-teal-700 font-medium">{e.receipt_book_name} #{e.receipt_no} · </span> : null}
                {e.collector} · {e.payment_mode} · {formatDate(e.date)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-num font-bold text-sm text-slate-900">{formatINR(e.status === "Collected" ? (e.received_amount || e.amount) : e.amount)}</div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${e.status === "Collected" ? "status-collected" : "status-pending"}`}>{e.status}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {showReceive && e.status === "Pending" && (
                <button onClick={() => markReceived(e)} data-testid={`modal-receive-${e.id}`}
                  className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center" title="Mark Received">
                  <CheckCircle2 size={14} />
                </button>
              )}
              <button onClick={() => onEdit(e)} data-testid={`modal-edit-${e.id}`}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center" title="Edit">
                <Pencil size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseRows({ entries, onEdit }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No expenses.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((e) => {
        const bal = (e.total_bill || 0) - (e.amount_paid || 0);
        return (
          <div key={e.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-expense-${e.id}`}>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{e.description}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {e.vendor ? `${e.vendor} · ` : ""}{e.paid_by} · {formatDate(e.date)}
                {bal > 0.01 ? ` · payable ${formatINR(bal)}` : ""}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-num font-bold text-sm text-red-700">-{formatINR(e.amount_paid)}</div>
              <div className="text-[10px] text-slate-500 font-num">bill {formatINR(e.total_bill)}</div>
            </div>
            <button onClick={() => onEdit(e)} data-testid={`modal-edit-exp-${e.id}`}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Pencil size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
function SumCell({ label, value, tone }) {
  const toneMap = {
    emerald: "text-emerald-700",
    red: "text-red-700",
    teal: "text-teal-700",
    amber: "text-amber-700",
    slate: "text-slate-900",
  };
  return (
    <div className="rounded-lg bg-white px-2.5 py-1.5 border border-slate-100">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</div>
      <div className={`text-sm font-bold font-num ${toneMap[tone] || toneMap.slate}`}>{value}</div>
    </div>
  );
}



function MemberRows({ members, onOpen, field, cta }) {
  if (members.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">Nothing here.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {members.map((m) => (
        <div key={m.name} className="px-3 py-2.5 flex items-center gap-2" data-testid={`modal-member-${m.name}`}>
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">{m.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">{m.name}</div>
            <div className="text-[10px] text-slate-500">Collected {formatINR(m.total_received)}</div>
          </div>
          <div className="font-num font-bold text-sm text-slate-900 shrink-0">{formatINR(m[field])}</div>
          <button onClick={() => onOpen(m)} data-testid={`modal-open-${m.name}`}
            className={`h-8 px-2 rounded-lg text-xs font-semibold shrink-0 ${cta ? "bg-teal-600 text-white hover:bg-teal-700" : "hover:bg-slate-100 text-slate-500"}`}>
            {cta || <ChevronRight size={14} />}
          </button>
        </div>
      ))}
    </div>
  );
}

function ReimbRows({ entries }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No reimbursements yet.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((r) => (
        <div key={r.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-reimb-${r.id}`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {r.paid_by} <span className="text-teal-600 mx-1">→</span> {r.to_member}
            </div>
            <div className="text-[10px] text-slate-500">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
          </div>
          <div className="font-num font-bold text-sm text-emerald-700 shrink-0">{formatINR(r.amount)}</div>
        </div>
      ))}
    </div>
  );
}
