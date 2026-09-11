import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { memberApi, transferApi, ledgerApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { ArrowRightLeft, Plus, Ban, User, HandCoins, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function Members() {
  const nav = useNavigate();
  const [members, setMembers] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("members");
  const [confirmVoid, setConfirmVoid] = useState(null);

  const load = async () => {
    setLoading(true);
    const [m, t, l] = await Promise.all([memberApi.summary(), transferApi.list(), ledgerApi.get()]);
    setMembers(m.members || []);
    setTransfers(t || []);
    setLedger(l.entries || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const doVoidTransfer = async () => {
    if (!confirmVoid) return;
    try {
      if (confirmVoid.voided) await transferApi.unvoidEntry(confirmVoid.id);
      else await transferApi.voidEntry(confirmVoid.id);
      toast.success(confirmVoid.voided ? "Transfer restored" : "Transfer voided");
      setConfirmVoid(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-4" data-testid="members-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Members & Ledger</h1>
        <button
          onClick={() => nav("/transfer/add")}
          data-testid="members-transfer-btn"
          className="h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 text-sm"
        >
          <ArrowRightLeft size={16} /> Transfer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" data-testid="members-tabs">
        {[
          { k: "members", l: "Members" },
          { k: "transfers", l: `Transfers (${transfers.filter(t => !t.voided).length})` },
          { k: "ledger", l: "Ledger" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            data-testid={`tab-${t.k}`}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.k ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading…</div>
      ) : tab === "members" ? (
        members.length === 0 ? (
          <div className="card-elevated p-8 text-center text-slate-500">No member activity yet.</div>
        ) : (
          <div className="space-y-2.5">
            {members.map((m) => (
              <div
                key={m.name}
                className="card-elevated p-4 cursor-pointer hover:border-teal-300 transition-colors"
                onClick={() => nav(`/members/${encodeURIComponent(m.name)}`)}
                data-testid={`member-card-${m.name}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                      {m.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.count_collections} collections</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Currently Held</div>
                    <div className={`font-num font-bold text-lg ${m.current_held < -0.01 ? "text-red-700" : m.current_held < 0.01 ? "text-slate-500" : "text-emerald-700"}`}>
                      {formatINR(m.current_held)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="text-slate-500">Collected</div>
                    <div className="font-num font-bold text-slate-900">{formatINR(m.total_received)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Trf Out</div>
                    <div className="font-num font-bold text-orange-700">{formatINR(m.transferred_out)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Trf In</div>
                    <div className="font-num font-bold text-blue-700">{formatINR(m.transferred_in)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Paid</div>
                    <div className="font-num font-bold text-red-700">{formatINR(m.paid_to_expenses)}</div>
                  </div>
                </div>
                {(m.personal_contribution > 0 || m.reimbursement_due > 0) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2" data-testid={`member-reimb-${m.name}`}>
                    <div className="text-xs">
                      <span className="text-slate-500">Personal: </span>
                      <span className="font-num font-bold text-amber-700">{formatINR(m.personal_contribution)}</span>
                      {m.reimbursement_due > 0.01 && (
                        <>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-500">Due: </span>
                          <span className="font-num font-bold text-red-700">{formatINR(m.reimbursement_due)}</span>
                        </>
                      )}
                    </div>
                    {m.reimbursement_due > 0.01 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); nav("/reimburse/add", { state: { to_member: m.name, amount: m.reimbursement_due } }); }}
                        data-testid={`reimburse-btn-${m.name}`}
                        className="text-xs h-7 px-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium"
                      >
                        Reimburse
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : tab === "transfers" ? (
        transfers.length === 0 ? (
          <div className="card-elevated p-8 text-center text-slate-500" data-testid="transfers-empty">
            <ArrowRightLeft size={28} className="mx-auto mb-2 text-slate-400" />
            No transfers yet<br />
            <button onClick={() => nav("/transfer/add")} className="mt-3 text-teal-700 font-medium hover:underline">Record your first transfer</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transfers.map((t) => (
              <div key={t.id} className={`card-elevated p-4 ${t.voided ? "opacity-70" : ""}`} data-testid={`transfer-card-${t.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-slate-900 ${t.voided ? "line-through" : ""}`}>
                        {t.from_member} <span className="text-teal-600 mx-1">→</span> {t.to_member}
                      </span>
                      {t.voided && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold status-void">VOID</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-num font-bold text-lg text-slate-900">{formatINR(t.amount)}</div>
                    {!t.voided && (
                      <button
                        onClick={() => setConfirmVoid(t)}
                        data-testid={`transfer-void-${t.id}`}
                        className="mt-1 text-xs text-red-600 font-medium hover:underline flex items-center gap-1 ml-auto"
                      >
                        <Ban size={11} /> Void
                      </button>
                    )}
                    {t.voided && (
                      <button
                        onClick={() => setConfirmVoid(t)}
                        data-testid={`transfer-unvoid-${t.id}`}
                        className="mt-1 text-xs text-emerald-700 font-medium hover:underline"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        ledger.length === 0 ? (
          <div className="card-elevated p-8 text-center text-slate-500">No transactions yet.</div>
        ) : (
          <div className="card-elevated p-2 divide-y divide-slate-100" data-testid="ledger-list">
            {ledger.map((e, i) => (
              <div key={i} className={`p-3 flex items-start gap-3 ${e.voided ? "opacity-60" : ""}`} data-testid={`ledger-row-${i}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  e.type === "chanda" ? "bg-emerald-100 text-emerald-700" :
                  e.type === "transfer" ? "bg-teal-100 text-teal-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {e.type === "chanda" ? <HandCoins size={16} /> : e.type === "transfer" ? <ArrowRightLeft size={16} /> : <Receipt size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">{e.type}{e.voided ? " · VOIDED" : ""}</div>
                  <div className={`text-sm font-medium text-slate-900 truncate ${e.voided ? "line-through" : ""}`}>
                    {e.from_party} <span className="text-slate-400 mx-1">→</span> {e.to_party}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {formatDate(e.date)}
                    {e.type === "chanda" && e.status === "Pending" ? " · Pending (promised only)" : ""}
                    {e.type === "expense" && e.total_bill > e.amount ? ` · Bill ${formatINR(e.total_bill)}` : ""}
                  </div>
                </div>
                <div className={`font-num font-bold ${
                  e.type === "chanda" ? "text-emerald-700" :
                  e.type === "transfer" ? "text-slate-700" :
                  "text-red-700"
                }`}>
                  {e.type === "expense" ? "-" : ""}{formatINR(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {confirmVoid && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmVoid(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="transfer-void-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {confirmVoid.voided ? "Restore Transfer?" : "Void Transfer?"}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmVoid.from_member} → {confirmVoid.to_member} · {formatINR(confirmVoid.amount)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmVoid(null)} className="flex-1 h-11 rounded-xl border border-slate-300 font-medium">Cancel</button>
              <button onClick={doVoidTransfer} data-testid="transfer-void-confirm"
                className={`flex-1 h-11 rounded-xl text-white font-semibold ${confirmVoid.voided ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {confirmVoid.voided ? "Restore" : "Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
