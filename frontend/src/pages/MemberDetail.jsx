import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { memberApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { ArrowLeft, HandCoins, ArrowRightLeft, Receipt } from "lucide-react";

export default function MemberDetail() {
  const { name } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    memberApi.detail(name).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [name]);

  if (loading) return <div className="pt-10 text-center text-slate-500">Loading…</div>;
  if (!data) return <div className="pt-10 text-center text-slate-500">Member not found</div>;

  const s = data.summary;

  return (
    <div className="space-y-4" data-testid="member-detail-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="member-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900 truncate" style={{ fontFamily: "Outfit" }}>{name}</h1>
      </div>

      {/* Current Held card */}
      <div className={`card-elevated p-5 ${s.current_held < -0.01 ? "bg-red-50" : s.current_held < 0.01 ? "bg-slate-50" : "bg-emerald-50"}`} data-testid="member-held-card">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Currently Held</div>
        <div className={`mt-1 text-4xl font-extrabold font-num tracking-tight ${s.current_held < -0.01 ? "text-red-700" : s.current_held < 0.01 ? "text-slate-500" : "text-emerald-700"}`} data-testid="member-current-held">
          {formatINR(s.current_held)}
        </div>
        <div className="text-xs text-slate-600 mt-1 font-num">
          {formatINR(s.total_received)} received
          {s.transferred_in > 0 && <> +{formatINR(s.transferred_in)} in</>}
          {s.transferred_out > 0 && <> −{formatINR(s.transferred_out)} out</>}
          {s.paid_to_expenses > 0 && <> −{formatINR(s.paid_to_expenses)} paid</>}
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <MiniCard label="Total Collected" value={formatINR(s.total_received)} sub={`${s.count_collections} entries`} color="emerald" />
        <MiniCard label="Total Promised" value={formatINR(s.total_promised)} sub={s.total_pending > 0 ? `${formatINR(s.total_pending)} pending` : "All received"} color="teal" />
        <MiniCard label="Transferred Out" value={formatINR(s.transferred_out)} color="orange" />
        <MiniCard label="Received From Others" value={formatINR(s.transferred_in)} color="blue" />
        <MiniCard label="Group Funds Paid" value={formatINR(s.group_funds_paid || 0)} color="red" />
        <MiniCard label="Personal Contribution" value={formatINR(s.personal_contribution || 0)} sub={s.reimbursement_due > 0.01 ? `${formatINR(s.reimbursement_due)} due` : "Fully reimbursed"} color="amber" />
        <MiniCard label="Reimbursement Received" value={formatINR(s.reimbursement_received || 0)} color="emerald" />
        <MiniCard label="Current Group Held" value={formatINR(s.current_held)} color={s.current_held < 0 ? "red" : "emerald"} />
      </div>

      {s.reimbursement_due > 0.01 && (
        <div className="card-elevated p-4 bg-amber-50 border-amber-200 flex items-center justify-between" data-testid="reimb-due-banner">
          <div>
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Reimbursement Due</div>
            <div className="text-2xl font-extrabold font-num text-amber-900" data-testid="member-reimb-due">{formatINR(s.reimbursement_due)}</div>
          </div>
          <button
            onClick={() => nav("/reimburse/add", { state: { to_member: name, amount: s.reimbursement_due } })}
            data-testid="member-reimburse-btn"
            className="h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
          >
            Reimburse Now
          </button>
        </div>
      )}

      {/* Chanda collections */}
      {data.chandas.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-chandas-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Collections ({data.chandas.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.chandas.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${c.voided ? "line-through" : ""}`}>{c.name}</div>
                  <div className="text-xs text-slate-500">{formatDate(c.date)} · {c.payment_mode} · {c.status}</div>
                </div>
                <div className="text-right">
                  <div className="font-num font-bold text-slate-900">{formatINR(c.received_amount)}</div>
                  {c.status === "Pending" && <div className="text-[10px] text-orange-600">promised {formatINR(c.amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers out */}
      {data.transfers_out.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-out-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Transferred Out ({data.transfers_out.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.transfers_out.map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${t.voided ? "line-through" : ""}`}>→ {t.to_member}</div>
                  <div className="text-xs text-slate-500">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700">{formatINR(t.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers in */}
      {data.transfers_in.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-in-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-blue-700" />
            <h2 className="font-semibold text-slate-900">Received From Others ({data.transfers_in.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.transfers_in.map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${t.voided ? "line-through" : ""}`}>← {t.from_member}</div>
                  <div className="text-xs text-slate-500">{formatDate(t.date)}</div>
                </div>
                <div className="font-num font-bold text-blue-700">{formatINR(t.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expenses paid */}
      {data.expenses.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-expenses-section">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={16} className="text-red-700" />
            <h2 className="font-semibold text-slate-900">Expenses Paid ({data.expenses.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.expenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${e.voided ? "line-through" : ""}`}>{e.description}</div>
                  <div className="text-xs text-slate-500">{formatDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-num font-bold text-red-700">-{formatINR(e.amount_paid)}</div>
                  {e.total_bill > e.amount_paid && <div className="text-[10px] text-slate-500">bill {formatINR(e.total_bill)}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Reimbursements received */}
      {data.reimbursements_in && data.reimbursements_in.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-in-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Received ({data.reimbursements_in.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.reimbursements_in.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${r.voided ? "line-through" : ""}`}>from {r.paid_by}</div>
                  <div className="text-xs text-slate-500">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-emerald-700">+{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reimbursements paid out */}
      {data.reimbursements_out && data.reimbursements_out.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-out-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Paid Out ({data.reimbursements_out.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.reimbursements_out.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className={`font-medium text-slate-900 ${r.voided ? "line-through" : ""}`}>to {r.to_member}</div>
                  <div className="text-xs text-slate-500">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700">-{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniCard({ label, value, sub, color }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-xl p-3 ${map[color] || map.slate}`}>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-extrabold font-num mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
