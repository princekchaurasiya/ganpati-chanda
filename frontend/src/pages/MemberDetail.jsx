import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { memberApi, chandaApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { ArrowLeft, HandCoins, ArrowRightLeft, Receipt, Pencil, Gift } from "lucide-react";
import { colorForEvent } from "@/lib/events";

export default function MemberDetail() {
  const { name } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      memberApi.detail(name).catch(() => null),
      chandaApi.list().catch(() => []),
    ]).then(([detail, allChandas]) => {
      setData(detail);
      const decoded = decodeURIComponent(name).toLowerCase().trim();
      setDonations((allChandas || []).filter((c) => (c.name || "").toLowerCase().trim() === decoded));
    }).finally(() => setLoading(false));
  }, [name]);

  if (loading) return <div className="pt-10 text-center text-slate-500">Loading…</div>;

  // Neither collector activity nor donor activity
  if (!data && donations.length === 0) {
    return (
      <div className="space-y-4 pb-24" data-testid="member-detail-page">
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="member-back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 truncate" style={{ fontFamily: "Outfit" }}>{name}</h1>
        </div>
        <div className="card-elevated p-6 text-center text-slate-500">Koi transaction nahi mila.</div>
      </div>
    );
  }

  const s = data ? data.summary : null;
  const isPureDonor = !s || (s.count_collections === 0 && s.transferred_out === 0 && s.transferred_in === 0 && s.paid_to_expenses === 0 && s.reimbursement_paid_out === 0 && s.reimbursement_received === 0);
  const donationTotal = donations.reduce((sum, d) => sum + (d.received_amount || d.amount || 0), 0);

  return (
    <div className="space-y-4 pb-24" data-testid="member-detail-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="member-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900 truncate" style={{ fontFamily: "Outfit" }}>{name}</h1>
      </div>

      <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-800 flex items-center gap-2" data-testid="member-edit-hint">
        <Pencil size={13} className="shrink-0" /> Galat entry? Kisi bhi row ke pencil icon pe tap karke saare fields (amount, mode, date, etc.) edit karo.
      </div>

      {/* Donations GIVEN by this person (donor role) */}
      {donations.length > 0 && (
        <section className="card-elevated p-4 bg-amber-50/40 border border-amber-100" data-testid="member-donations-given-section">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-amber-700" />
              <h2 className="font-semibold text-slate-900">Donations Given ({donations.length})</h2>
            </div>
            <div className="font-num font-bold text-amber-700">{formatINR(donationTotal)}</div>
          </div>
          <div className="text-[11px] text-amber-800 mb-2">
            {name} ne khud diye — ye paisa collector ke naam par count hota hai.
          </div>
          <div className="divide-y divide-amber-100/70">
            {donations.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-donation-given-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${c.voided ? "line-through" : ""}`}>
                    <span className="truncate">to {c.collector}</span>
                    {c.event && (() => { const cc = colorForEvent(c.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-donation-given-event-${c.id}`}>{c.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.receipt_book_name ? <span className="text-teal-700 font-medium">{c.receipt_book_name} #{c.receipt_no} · </span> : null}
                    {formatDate(c.date)} · {c.payment_mode} · {c.status}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-amber-800">{formatINR(c.received_amount || c.amount)}</div>
                  {c.status === "Pending" && <div className="text-[10px] text-orange-600">promised {formatINR(c.amount)}</div>}
                </div>
                {!c.voided && (
                  <button
                    onClick={() => nav("/add", { state: { entry: c } })}
                    data-testid={`edit-donation-given-${c.id}`}
                    title="Edit donation"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-amber-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {isPureDonor && (
            <div className="mt-2 text-[11px] text-slate-500 italic">
              Note: {name} sirf donor hai — koi chanda collect nahi kiya, isliye niche member stats sab zero hain.
            </div>
          )}
        </section>
      )}

      {/* Current Held card */}
      {s && !isPureDonor && (
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
      )}

      {/* Summary grid */}
      {s && !isPureDonor && (
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
      )}

      {s && s.reimbursement_due > 0.01 && (
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
      {data && data.chandas.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-chandas-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Collections ({data.chandas.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.chandas.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-chanda-row-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${c.voided ? "line-through" : ""}`}>
                    <span className="truncate">{c.name}</span>
                    {c.event && (() => { const cc = colorForEvent(c.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-chanda-event-${c.id}`}>{c.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.receipt_book_name ? <span className="text-teal-700 font-medium">{c.receipt_book_name} #{c.receipt_no} · </span> : null}
                    {formatDate(c.date)} · {c.payment_mode} · {c.status}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-slate-900">{formatINR(c.received_amount)}</div>
                  {c.status === "Pending" && <div className="text-[10px] text-orange-600">promised {formatINR(c.amount)}</div>}
                </div>
                {!c.voided && (
                  <button
                    onClick={() => nav("/add", { state: { entry: c } })}
                    data-testid={`edit-chanda-${c.id}`}
                    title="Edit chanda"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers out */}
      {data && data.transfers_out.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-out-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Transferred Out ({data.transfers_out.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.transfers_out.map((t) => (
              <div key={t.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-trf-out-row-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${t.voided ? "line-through" : ""}`}>→ {t.to_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700 shrink-0">{formatINR(t.amount)}</div>
                {!t.voided && (
                  <button
                    onClick={() => nav("/transfer/add", { state: { entry: t } })}
                    data-testid={`edit-transfer-${t.id}`}
                    title="Edit transfer"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers in */}
      {data && data.transfers_in.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-in-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-blue-700" />
            <h2 className="font-semibold text-slate-900">Received From Others ({data.transfers_in.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.transfers_in.map((t) => (
              <div key={t.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-trf-in-row-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${t.voided ? "line-through" : ""}`}>← {t.from_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(t.date)}</div>
                </div>
                <div className="font-num font-bold text-blue-700 shrink-0">{formatINR(t.amount)}</div>
                {!t.voided && (
                  <button
                    onClick={() => nav("/transfer/add", { state: { entry: t } })}
                    data-testid={`edit-transfer-in-${t.id}`}
                    title="Edit transfer"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expenses paid */}
      {data && data.expenses.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-expenses-section">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={16} className="text-red-700" />
            <h2 className="font-semibold text-slate-900">Expenses Paid ({data.expenses.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.expenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-exp-row-${e.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${e.voided ? "line-through" : ""}`}>
                    <span className="truncate">{e.description}</span>
                    {e.event && (() => { const cc = colorForEvent(e.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-exp-event-${e.id}`}>{e.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-red-700">-{formatINR(e.amount_paid)}</div>
                  {e.total_bill > e.amount_paid && <div className="text-[10px] text-slate-500">bill {formatINR(e.total_bill)}</div>}
                </div>
                {!e.voided && (
                  <button
                    onClick={() => nav("/expenses/add", { state: { entry: e } })}
                    data-testid={`edit-expense-${e.id}`}
                    title="Edit expense"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Reimbursements received */}
      {data && data.reimbursements_in && data.reimbursements_in.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-in-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Received ({data.reimbursements_in.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.reimbursements_in.map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-reimb-in-row-${r.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${r.voided ? "line-through" : ""}`}>from {r.paid_by}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-emerald-700 shrink-0">+{formatINR(r.amount)}</div>
                {!r.voided && (
                  <button
                    onClick={() => nav("/reimburse/add", { state: { entry: r } })}
                    data-testid={`edit-reimb-in-${r.id}`}
                    title="Edit reimbursement"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reimbursements paid out */}
      {data && data.reimbursements_out && data.reimbursements_out.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-out-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Paid Out ({data.reimbursements_out.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.reimbursements_out.map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-reimb-out-row-${r.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${r.voided ? "line-through" : ""}`}>to {r.to_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700 shrink-0">-{formatINR(r.amount)}</div>
                {!r.voided && (
                  <button
                    onClick={() => nav("/reimburse/add", { state: { entry: r } })}
                    data-testid={`edit-reimb-out-${r.id}`}
                    title="Edit reimbursement"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
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
