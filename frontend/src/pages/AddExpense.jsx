import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { expenseApi, memberApi, chandaApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, Receipt, IndianRupee, Calendar as CalIcon, Tag, Info, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_EVENT, mergeEvents } from "@/lib/events";

const CATEGORIES = ["Mandap", "Murti", "Banner", "Decoration", "Police & BMC", "Documents", "Dahi Handi", "Aarti Samagri", "Band Baja", "Materials", "Food", "Rent", "Utilities", "Transport", "Other"];
const MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

export default function AddExpense() {
  const nav = useNavigate();
  const loc = useLocation();
  const editing = loc.state?.entry || null;
  const returnTo = loc.state?.returnTo;

  const [description, setDescription] = useState(editing?.description || "");
  const [vendor, setVendor] = useState(editing?.vendor || "");
  const [category, setCategory] = useState(editing?.category || "Materials");
  const [totalBill, setTotalBill] = useState(editing?.total_bill ? String(editing.total_bill) : "");
  const [amountPaid, setAmountPaid] = useState(editing?.amount_paid ? String(editing.amount_paid) : "");
  const [groupFunds, setGroupFunds] = useState(editing?.group_funds_used !== undefined ? String(editing.group_funds_used) : "");
  const [personal, setPersonal] = useState(editing?.personal_contribution !== undefined ? String(editing.personal_contribution) : "0");
  const [paidBy, setPaidBy] = useState(editing?.paid_by || loc.state?.paid_by || "");
  const [mode, setMode] = useState(editing?.payment_mode || "Cash");
  const [dateStr, setDateStr] = useState(editing?.date || todayISO());
  const [note, setNote] = useState(editing?.note || "");
  const [event, setEvent] = useState(editing?.event || (editing?.category === "Dahi Handi" ? "Dahi Handi" : DEFAULT_EVENT));
  const [availableEvents, setAvailableEvents] = useState(mergeEvents([editing?.event].filter(Boolean)));
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    memberApi.summary().then((r) => setMembers(r.members || [])).catch(() => {});
    Promise.all([expenseApi.list(), chandaApi.list()]).then(([exps, chs]) => {
      const used = [...(exps || []).map((e) => e.event), ...(chs || []).map((c) => c.event)].filter(Boolean);
      setAvailableEvents(mergeEvents([...used, editing?.event].filter(Boolean)));
    }).catch(() => {});
  }, []);

  const paidByMember = members.find((m) => m.name === paidBy);
  const availableGroupCash = paidByMember?.current_held ?? 0;

  const paidNum = Number(amountPaid) || 0;
  const groupNum = Number(groupFunds) || 0;
  const personalNum = Number(personal) || 0;
  const splitSum = groupNum + personalNum;
  const splitMismatch = Math.abs(splitSum - paidNum) > 0.01;
  const overGroupCash = !editing && groupNum > availableGroupCash;

  // Auto-suggest split when Amount Paid or Paid By changes
  useEffect(() => {
    if (editing) return;
    if (paidNum <= 0 || !paidBy) return;
    const suggestedGroup = Math.min(paidNum, Math.max(availableGroupCash, 0));
    setGroupFunds(String(Math.round(suggestedGroup)));
    setPersonal(String(Math.round(paidNum - suggestedGroup)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountPaid, paidBy, availableGroupCash]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!description.trim()) return toast.error("Description भरें");
    if (!paidBy) return toast.error("Paid By member चुनें");
    if (!totalBill || Number(totalBill) <= 0) return toast.error("Total Bill भरें");
    if (paidNum < 0) return toast.error("Amount Paid invalid");
    if (paidNum > Number(totalBill) + 1e-6) return toast.error("Amount Paid Total Bill से ज़्यादा नहीं हो सकता");
    if (splitMismatch) return toast.error(`Group + Personal (₹${splitSum}) must equal Amount Paid (₹${paidNum})`);

    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        vendor: vendor.trim() || null,
        category,
        total_bill: Number(totalBill),
        amount_paid: paidNum,
        group_funds_used: groupNum,
        personal_contribution: personalNum,
        paid_by: paidBy,
        payment_mode: mode,
        date: dateStr,
        note: note.trim() || null,
        event: event || DEFAULT_EVENT,
      };
      if (editing) {
        await expenseApi.update(editing.id, payload);
        toast.success("Expense updated");
      } else {
        await expenseApi.create(payload);
        toast.success(`${description}: ${formatINR(paidNum)} paid`);
      }
      nav(returnTo || "/expenses");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const balancePayable = (Number(totalBill) || 0) - paidNum;

  return (
    <div className="space-y-4" data-testid="add-expense-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="expense-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>
          {editing ? "Edit Expense" : "Add Expense (खर्चा)"}
        </h1>
      </div>

      <form onSubmit={submit} className="card-elevated p-5 space-y-5">
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Receipt size={15} /> Description
          </label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="जैसे Murti, Tent, Prasad" data-testid="exp-description-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Vendor / Person (optional)</label>
          <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
            placeholder="जैसे Murti Wale" data-testid="exp-vendor-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Sparkles size={15} /> Event / Purpose
          </label>
          <div className="flex flex-wrap gap-1.5" data-testid="exp-event-chips">
            {availableEvents.map((ev) => (
              <button type="button" key={ev} onClick={() => setEvent(ev)}
                data-testid={`exp-event-${ev.replace(/\s+/g,'-').toLowerCase()}`}
                className={`chip ${event === ev ? "chip-active" : ""}`}>{ev}</button>
            ))}
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("New event name (e.g. Navratri, Holi)");
                const trimmed = (name || "").trim();
                if (!trimmed) return;
                if (!availableEvents.includes(trimmed)) setAvailableEvents((s) => [...s, trimmed]);
                setEvent(trimmed);
              }}
              data-testid="exp-event-new-btn"
              className="chip"
            >
              + New
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Tag size={15} /> Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setCategory(c)}
                data-testid={`exp-cat-btn-${c.toLowerCase()}`}
                className={`chip ${category === c ? "chip-active" : ""}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <IndianRupee size={15} /> Total Bill
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input type="number" inputMode="numeric" value={totalBill} onChange={(e) => setTotalBill(e.target.value)}
                placeholder="0" data-testid="exp-total-bill-input"
                className="w-full h-12 pl-7 pr-3 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base font-num font-bold" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Amount Paid Now</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input type="number" inputMode="numeric" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0" data-testid="exp-amount-paid-input"
                className="w-full h-12 pl-7 pr-3 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base font-num font-bold" />
            </div>
          </div>
        </div>

        {balancePayable > 0 && (
          <div className="text-xs text-orange-700 -mt-3" data-testid="exp-balance-payable-hint">
            Balance Payable to vendor: <span className="font-num font-bold">{formatINR(balancePayable)}</span>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <User size={15} /> Paid By (कौन ने पैसे दिए?)
          </label>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
            data-testid="exp-paidby-select"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white">
            <option value="">-- Select member --</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} · Group cash: ₹{Math.round(Math.max(m.current_held, 0)).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          {paidBy && paidByMember && (
            <div className="mt-1 text-xs text-slate-600" data-testid="exp-available-hint">
              {paidBy} has <strong className="font-num">{formatINR(availableGroupCash)}</strong> group cash available
            </div>
          )}
        </div>

        {/* Payment Sources */}
        {paidNum > 0 && paidBy && (
          <div className="card-elevated p-3 bg-slate-50 border-slate-200 space-y-2" data-testid="exp-split-section">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Payment Sources</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">From Group Funds</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
                  <input type="number" inputMode="numeric" value={groupFunds}
                    onChange={(e) => { setGroupFunds(e.target.value); setPersonal(String(Math.max(0, paidNum - Number(e.target.value || 0)))); }}
                    data-testid="exp-group-funds-input"
                    className={`w-full h-11 pl-7 pr-3 rounded-lg border ${overGroupCash ? "border-red-400" : "border-slate-300"} focus:border-teal-600 outline-none text-base font-num font-bold`} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Personal ({paidBy || "member"})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
                  <input type="number" inputMode="numeric" value={personal}
                    onChange={(e) => { setPersonal(e.target.value); setGroupFunds(String(Math.max(0, paidNum - Number(e.target.value || 0)))); }}
                    data-testid="exp-personal-input"
                    className="w-full h-11 pl-7 pr-3 rounded-lg border border-slate-300 focus:border-teal-600 outline-none text-base font-num font-bold" />
                </div>
              </div>
            </div>
            <div className={`text-xs font-num flex items-center gap-1 ${splitMismatch ? "text-red-600" : "text-emerald-700"}`} data-testid="exp-split-sum">
              <Info size={12} /> Sum: ₹{Math.round(splitSum).toLocaleString("en-IN")} {splitMismatch ? `≠ ₹${paidNum.toLocaleString("en-IN")} (Amount Paid)` : "✓ matches Amount Paid"}
            </div>
            {overGroupCash && (
              <div className="text-xs text-red-600 flex items-start gap-1" data-testid="exp-overdraw-warn">
                <Info size={12} className="mt-0.5 shrink-0" />
                Group Funds exceeds {paidBy}'s available cash ({formatINR(availableGroupCash)}). Adjust to record the rest as personal contribution.
              </div>
            )}
            {personalNum > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2" data-testid="exp-personal-note">
                <strong>{paidBy}</strong> will have <strong className="font-num">{formatINR(personalNum)}</strong> reimbursement due
                (personal money advanced for the group).
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Payment Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)}
                data-testid={`exp-mode-btn-${m.replace(/\s/g,'-').toLowerCase()}`}
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
          <div className="flex gap-2">
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}
              data-testid="exp-date-input"
              className="flex-1 h-12 px-4 rounded-xl border border-slate-300 outline-none text-base" />
            <button type="button" onClick={() => setDateStr(todayISO())} data-testid="exp-today-btn"
              className="px-4 h-12 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50">Today</button>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Note (optional)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            data-testid="exp-note-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 outline-none text-base" />
        </div>

        <button type="submit" disabled={saving || splitMismatch || overGroupCash}
          data-testid="exp-submit-btn"
          className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
          <Save size={18} /> {editing ? "Update Expense" : "Save Expense"}
        </button>
      </form>
    </div>
  );
}
