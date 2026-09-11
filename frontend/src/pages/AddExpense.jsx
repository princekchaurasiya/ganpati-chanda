import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { expenseApi, collectorApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, Receipt, IndianRupee, Calendar as CalIcon, Tag } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Materials", "Food", "Decoration", "Rent", "Utilities", "Transport", "Other"];
const MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

export default function AddExpense() {
  const nav = useNavigate();
  const loc = useLocation();
  const editing = loc.state?.entry || null;

  const [description, setDescription] = useState(editing?.description || "");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category || "Materials");
  const [paidBy, setPaidBy] = useState(editing?.paid_by || "");
  const [mode, setMode] = useState(editing?.payment_mode || "Cash");
  const [dateStr, setDateStr] = useState(editing?.date || todayISO());
  const [collectors, setCollectors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    collectorApi.list().then(setCollectors).catch(() => {});
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (!description.trim()) return toast.error("Description भरें");
    if (!amount || Number(amount) <= 0) return toast.error("Amount भरें");

    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        amount: Number(amount),
        category,
        payment_mode: mode,
        paid_by: paidBy || null,
        date: dateStr,
      };
      if (editing) {
        await expenseApi.update(editing.id, payload);
        toast.success("Expense updated");
      } else {
        await expenseApi.create(payload);
        toast.success(`-${formatINR(payload.amount)} · ${payload.description}`);
      }
      nav("/expenses");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="add-expense-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="expense-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>
          {editing ? "Edit Expense" : "Add Expense (खर्चा जोड़ें)"}
        </h1>
      </div>

      <form onSubmit={submit} className="card-elevated p-5 space-y-5">
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Receipt size={15} /> Description (किस पर खर्चा?)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="जैसे Tent, Prasad, Flowers"
            data-testid="exp-description-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
          />
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
              data-testid="exp-amount-input"
              className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-lg font-num font-bold"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Tag size={15} /> Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                data-testid={`exp-cat-btn-${c.toLowerCase()}`}
                className={`chip ${category === c ? "chip-active" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Paid By (optional)</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            data-testid="exp-paidby-select"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white"
          >
            <option value="">-- None --</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Payment Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                data-testid={`exp-mode-btn-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                  mode === m ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
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
              data-testid="exp-date-input"
              className="flex-1 h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base"
            />
            <button
              type="button"
              onClick={() => setDateStr(todayISO())}
              data-testid="exp-today-btn"
              className="px-4 h-12 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          data-testid="exp-submit-btn"
          className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={18} /> {editing ? "Update Expense" : "Save Expense"}
        </button>
      </form>
    </div>
  );
}
