import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { reimbursementApi, memberApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, HandCoins, IndianRupee, Calendar as CalIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

export default function AddReimbursement() {
  const nav = useNavigate();
  const loc = useLocation();
  const initialTo = loc.state?.to_member || "";
  const initialAmount = loc.state?.amount ? String(loc.state.amount) : "";

  const [members, setMembers] = useState([]);
  const [paidBy, setPaidBy] = useState("");
  const [toMember, setToMember] = useState(initialTo);
  const [amount, setAmount] = useState(initialAmount);
  const [mode, setMode] = useState("Cash");
  const [dateStr, setDateStr] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    memberApi.summary().then((r) => setMembers(r.members || [])).catch(() => {});
  }, []);

  const paidByMember = members.find((m) => m.name === paidBy);
  const toM = members.find((m) => m.name === toMember);
  const availableHeld = paidByMember?.current_held ?? 0;
  const reimbDue = toM?.reimbursement_due ?? 0;
  const exceedsHeld = Number(amount) > availableHeld;
  const exceedsDue = Number(amount) > reimbDue;

  const submit = async (e) => {
    e?.preventDefault();
    if (!paidBy) return toast.error("Paying member चुनें");
    if (!toMember) return toast.error("Reimbursing to member चुनें");
    if (paidBy === toMember) return toast.error("Cannot reimburse yourself");
    if (!amount || Number(amount) <= 0) return toast.error("Amount भरें");

    setSaving(true);
    try {
      await reimbursementApi.create({
        paid_by: paidBy, to_member: toMember, amount: Number(amount),
        payment_mode: mode, date: dateStr, note: note.trim() || null,
      });
      toast.success(`${paidBy} → ${toMember} reimbursed ${formatINR(Number(amount))}`);
      nav("/members");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const membersWithDue = members.filter((m) => m.reimbursement_due > 0.01);

  return (
    <div className="space-y-4" data-testid="add-reimbursement-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="reimb-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Reimburse Member</h1>
      </div>

      <div className="card-elevated p-4 bg-amber-50 border-amber-200 flex gap-2">
        <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          Pay back a member who advanced their own money for an expense.
          This will NOT count as Chanda or a new expense — it just clears the personal contribution.
        </div>
      </div>

      {membersWithDue.length === 0 ? (
        <div className="card-elevated p-8 text-center text-slate-500" data-testid="no-dues">
          <HandCoins size={28} className="mx-auto mb-2 text-slate-400" />
          No outstanding personal contributions right now.
        </div>
      ) : (
        <form onSubmit={submit} className="card-elevated p-5 space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Reimburse To (जिनका पैसा वापस करना है)</label>
            <select value={toMember} onChange={(e) => setToMember(e.target.value)}
              data-testid="reimb-to-select"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white">
              <option value="">-- Select member --</option>
              {membersWithDue.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · Due: ₹{Math.round(m.reimbursement_due).toLocaleString("en-IN")}
                </option>
              ))}
            </select>
            {toMember && (
              <div className="mt-1 text-xs text-slate-600" data-testid="reimb-due-hint">
                Outstanding: <strong className="font-num">{formatINR(reimbDue)}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Paid From (Group Fund holder)</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
              data-testid="reimb-paidby-select"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white">
              <option value="">-- Select member --</option>
              {members.filter((m) => m.name !== toMember && m.current_held > 0.01).map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · Held: ₹{Math.round(m.current_held).toLocaleString("en-IN")}
                </option>
              ))}
            </select>
            {paidBy && (
              <div className={`mt-1 text-xs ${exceedsHeld ? "text-red-600" : "text-slate-600"}`}>
                {paidBy} has <strong className="font-num">{formatINR(availableHeld)}</strong> group cash
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <IndianRupee size={15} /> Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" data-testid="reimb-amount-input"
                className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-lg font-num font-bold" />
            </div>
            {toMember && (
              <button type="button" onClick={() => setAmount(String(Math.round(reimbDue)))} data-testid="reimb-fill-due"
                className="mt-2 text-xs text-teal-700 font-medium hover:underline">
                Fill full due ({formatINR(reimbDue)})
              </button>
            )}
            {exceedsDue && amount && (
              <div className="mt-1 text-xs text-red-600" data-testid="reimb-exceeds-due">
                Amount exceeds outstanding due of {formatINR(reimbDue)}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Payment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button type="button" key={m} onClick={() => setMode(m)}
                  data-testid={`reimb-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                  className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                    mode === m ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <CalIcon size={15} /> Date
            </label>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}
              data-testid="reimb-date-input"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 outline-none text-base" />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              data-testid="reimb-note-input"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 outline-none text-base" />
          </div>

          <button type="submit" disabled={saving || exceedsHeld || exceedsDue}
            data-testid="reimb-submit-btn"
            className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
            <Save size={18} /> Record Reimbursement
          </button>
        </form>
      )}
    </div>
  );
}
