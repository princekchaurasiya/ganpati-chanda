import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { transferApi, memberApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, ArrowRightLeft, IndianRupee, Calendar as CalIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AddTransfer() {
  const nav = useNavigate();
  const loc = useLocation();
  const editing = loc.state?.entry || null;
  const returnTo = loc.state?.returnTo;

  const [members, setMembers] = useState([]);
  const [fromMember, setFromMember] = useState(editing?.from_member || loc.state?.from_member || "");
  const [toMember, setToMember] = useState(editing?.to_member || loc.state?.to_member || "");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [dateStr, setDateStr] = useState(editing?.date || todayISO());
  const [note, setNote] = useState(editing?.note || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    memberApi.summary().then((r) => setMembers(r.members || [])).catch(() => {});
  }, []);

  const fromHeld = members.find((m) => m.name === fromMember)?.current_held ?? null;
  const exceedsHeld = fromHeld !== null && Number(amount) > fromHeld && !editing;

  const submit = async (e) => {
    e?.preventDefault();
    if (!fromMember) return toast.error("From member चुनें");
    if (!toMember) return toast.error("To member चुनें");
    if (fromMember === toMember) return toast.error("From and To must differ");
    if (!amount || Number(amount) <= 0) return toast.error("Amount भरें");

    setSaving(true);
    try {
      const payload = { from_member: fromMember, to_member: toMember, amount: Number(amount), date: dateStr, note: note || null };
      if (editing) {
        await transferApi.update(editing.id, payload);
        toast.success("Transfer updated");
      } else {
        await transferApi.create(payload);
        toast.success(`${fromMember} → ${toMember} ${formatINR(Number(amount))}`);
      }
      nav(returnTo || "/members");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to save transfer";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="add-transfer-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="transfer-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>
          {editing ? "Edit Transfer" : "Transfer Existing Collection"}
        </h1>
      </div>

      <div className="card-elevated p-4 bg-amber-50 border-amber-200 flex gap-2" data-testid="transfer-notice">
        <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <strong>Note:</strong> Transfers only change who currently holds the money.
          They will NOT increase Total Chanda.
        </div>
      </div>

      <form onSubmit={submit} className="card-elevated p-5 space-y-5">
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">From (कौन दे रहा है?)</label>
          <select
            value={fromMember}
            onChange={(e) => setFromMember(e.target.value)}
            data-testid="transfer-from-select"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white"
          >
            <option value="">-- Select member --</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} · Held: ₹{Math.round(m.current_held).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          {fromMember && fromHeld !== null && (
            <div className={`mt-1 text-xs ${fromHeld < 0 ? "text-red-600" : "text-slate-600"}`} data-testid="from-held-hint">
              {fromMember} के पास अभी: <strong className="font-num">{formatINR(fromHeld)}</strong>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center py-1">
          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
            <ArrowRightLeft size={18} />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">To (किसको दे रहा है?)</label>
          <select
            value={toMember}
            onChange={(e) => setToMember(e.target.value)}
            data-testid="transfer-to-select"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white"
          >
            <option value="">-- Select member --</option>
            {members.filter((m) => m.name !== fromMember).map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <IndianRupee size={15} /> Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              data-testid="transfer-amount-input"
              className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-lg font-num font-bold"
            />
          </div>
          {exceedsHeld && (
            <div className="mt-1 text-xs text-red-600" data-testid="transfer-overdraw-warn">
              Amount is more than {fromMember}'s available balance.
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <CalIcon size={15} /> Date
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              data-testid="transfer-date-input"
              className="flex-1 h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base"
            />
            <button
              type="button"
              onClick={() => setDateStr(todayISO())}
              data-testid="transfer-today-btn"
              className="px-4 h-12 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="जैसे 'Murti payment के लिए handed over'"
            data-testid="transfer-note-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base"
          />
        </div>

        {fromMember && toMember && amount && (
          <div className="card-elevated p-4 bg-teal-50 border-teal-200" data-testid="transfer-preview">
            <div className="text-xs font-semibold text-teal-700 mb-1">Preview</div>
            <div className="font-num text-slate-900">
              <span className="font-bold">{fromMember}</span>
              <span className="mx-2 text-teal-600">→</span>
              <span className="font-bold">{toMember}</span>
              <span className="mx-2 text-teal-600">=</span>
              <span className="font-bold">{formatINR(Number(amount))}</span>
            </div>
            <div className="text-[11px] text-teal-800 mt-1">
              This will not add to Total Chanda. Only changes who currently holds the money.
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          data-testid="transfer-submit-btn"
          className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={18} /> {editing ? "Update Transfer" : "Record Transfer"}
        </button>
      </form>
    </div>
  );
}
