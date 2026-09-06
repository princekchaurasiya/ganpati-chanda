import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { chandaApi, collectorApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, User, IndianRupee, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [101, 251, 501, 1100, 2100, 5100];
const MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

export default function AddChanda() {
  const nav = useNavigate();
  const loc = useLocation();
  const editing = loc.state?.entry || null;

  const [name, setName] = useState(editing?.name || "");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [collector, setCollector] = useState(editing?.collector || "");
  const [newCollector, setNewCollector] = useState("");
  const [mode, setMode] = useState(editing?.payment_mode || "Cash");
  const [status, setStatus] = useState(editing?.status || "Collected");
  const [dateStr, setDateStr] = useState(editing?.date || todayISO());
  const [collectors, setCollectors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [useCustomCollector, setUseCustomCollector] = useState(false);

  useEffect(() => {
    collectorApi.list().then(setCollectors).catch(() => {});
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    const finalCollector = useCustomCollector ? newCollector.trim() : collector;
    if (!name.trim()) return toast.error("नाम भरें (Name required)");
    if (!amount || Number(amount) <= 0) return toast.error("Amount भरें");
    if (!finalCollector) return toast.error("Collector चुनें");

    setSaving(true);
    try {
      if (useCustomCollector && newCollector.trim()) {
        try { await collectorApi.create(newCollector.trim()); } catch (_e) { /* ignore duplicate */ }
      }
      const payload = {
        name: name.trim(),
        amount: Number(amount),
        collector: finalCollector,
        payment_mode: mode,
        status,
        date: dateStr,
      };
      if (editing) {
        await chandaApi.update(editing.id, payload);
        toast.success("Entry updated");
      } else {
        await chandaApi.create(payload);
        toast.success(`${formatINR(payload.amount)} added from ${payload.name}`);
      }
      nav("/list");
    } catch (err) {
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="add-chanda-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="add-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Outfit"}}>
          {editing ? "Edit Chanda" : "Add Chanda (चंदा जोड़ें)"}
        </h1>
      </div>

      <form onSubmit={submit} className="card-elevated p-5 space-y-5">
        {/* Name */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <User size={15} /> Donor Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="जैसे Ramesh Kumar"
            data-testid="add-name-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
          />
        </div>

        {/* Amount */}
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
              data-testid="add-amount-input"
              className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-lg font-num font-bold"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setAmount(String(p))}
                data-testid={`preset-${p}`}
                className={`chip ${Number(amount) === p ? "chip-active" : ""}`}
              >
                ₹{p.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        {/* Collector */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Collector (Kisko Diya)</label>
          {!useCustomCollector ? (
            <>
              <select
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                data-testid="add-collector-select"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white"
              >
                <option value="">-- Select Collector --</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setUseCustomCollector(true); setCollector(""); }}
                data-testid="add-new-collector-toggle"
                className="mt-2 text-sm font-medium text-teal-700 hover:underline"
              >
                + Add new collector
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={newCollector}
                onChange={(e) => setNewCollector(e.target.value)}
                placeholder="Collector का नाम टाइप करें"
                data-testid="add-new-collector-input"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
              />
              <button
                type="button"
                onClick={() => { setUseCustomCollector(false); setNewCollector(""); }}
                data-testid="add-cancel-new-collector"
                className="mt-2 text-sm font-medium text-slate-600 hover:underline"
              >
                ← Choose from list
              </button>
            </>
          )}
        </div>

        {/* Payment Mode */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Payment Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                data-testid={`add-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                  mode === m ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {["Collected", "Pending"].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                data-testid={`add-status-${s.toLowerCase()}`}
                className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                  status === s
                    ? s === "Collected"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <CalIcon size={15} /> Date
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              data-testid="add-date-input"
              className="flex-1 h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base"
            />
            <button
              type="button"
              onClick={() => setDateStr(todayISO())}
              data-testid="add-today-btn"
              className="px-4 h-12 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          data-testid="add-chanda-submit-btn"
          className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={18} /> {editing ? "Update Entry" : "Save Chanda"}
        </button>
      </form>
    </div>
  );
}
