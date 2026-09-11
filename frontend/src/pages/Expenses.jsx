import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { expenseApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Search, Pencil, Ban, RotateCcw, Plus, X, Receipt } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["All", "Materials", "Food", "Decoration", "Rent", "Utilities", "Transport", "Other"];
const MODES = ["All", "Cash", "UPI", "Bank Transfer", "Other"];

const catColor = {
  Materials: { bg: "bg-blue-50", text: "text-blue-700" },
  Food: { bg: "bg-orange-50", text: "text-orange-700" },
  Decoration: { bg: "bg-pink-50", text: "text-pink-700" },
  Rent: { bg: "bg-purple-50", text: "text-purple-700" },
  Utilities: { bg: "bg-cyan-50", text: "text-cyan-700" },
  Transport: { bg: "bg-amber-50", text: "text-amber-700" },
  Other: { bg: "bg-slate-100", text: "text-slate-700" },
};

export default function Expenses() {
  const nav = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [mode, setMode] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await expenseApi.list();
    setEntries(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (showVoided ? true : !e.voided))
      .filter((e) => (cat === "All" ? true : e.category === cat))
      .filter((e) => (mode === "All" ? true : e.payment_mode === mode))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => {
        if (!q.trim()) return true;
        const qq = q.trim().toLowerCase();
        return e.description.toLowerCase().includes(qq) || (e.paid_by || "").toLowerCase().includes(qq);
      });
  }, [entries, q, cat, mode, from, to, showVoided]);

  const totalAmount = filtered.filter((e) => !e.voided).reduce((s, e) => s + e.amount, 0);

  const doVoid = async () => {
    if (!confirmVoid) return;
    try {
      if (confirmVoid.voided) {
        await expenseApi.unvoidEntry(confirmVoid.id);
        toast.success("Expense restored");
      } else {
        await expenseApi.voidEntry(confirmVoid.id);
        toast.success("Expense voided");
      }
      setConfirmVoid(null);
      load();
    } catch { toast.error("Failed"); }
  };

  const clearFilters = () => { setQ(""); setCat("All"); setMode("All"); setFrom(""); setTo(""); };

  return (
    <div className="space-y-4" data-testid="expenses-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Expenses (खर्चे)</h1>
        <button
          onClick={() => nav("/expenses/add")}
          data-testid="expenses-add-btn"
          className="h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 text-sm"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search description or paid-by"
          data-testid="expenses-search-input"
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base bg-white"
        />
      </div>

      {/* Filters */}
      <div className="card-elevated p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} data-testid={`exp-cat-${c.toLowerCase()}`}
                className={`chip ${cat === c ? "chip-active" : ""}`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</div>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button key={m} onClick={() => setMode(m)} data-testid={`exp-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`chip ${mode === m ? "chip-active" : ""}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="exp-from-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="exp-to-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)}
              data-testid="exp-show-voided" className="w-4 h-4" />
            Show voided
          </label>
          <button onClick={clearFilters} data-testid="exp-clear-filters"
            className="text-sm font-medium text-teal-700 flex items-center gap-1 hover:underline">
            <X size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1 text-sm text-slate-600">
        <div data-testid="exp-filtered-count">
          <span className="font-bold text-slate-900">{filtered.length}</span> expenses
        </div>
        <div data-testid="exp-filtered-total">
          Total: <span className="font-num font-bold text-red-700">{formatINR(totalAmount)}</span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-slate-500" data-testid="exp-empty-list">
          <Receipt size={28} className="mx-auto mb-2 text-slate-400" />
          कोई खर्चा नहीं मिला<br />
          <span className="text-xs">Add your first expense to track spending</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => {
            const c = catColor[e.category] || catColor.Other;
            return (
              <div key={e.id} className={`card-elevated p-4 ${e.voided ? "opacity-70" : ""}`} data-testid={`expense-card-${e.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`font-semibold text-slate-900 truncate ${e.voided ? "line-through" : ""}`}>{e.description}</div>
                      {e.voided && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold status-void">VOID</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}>{e.category}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {e.paid_by ? `${e.paid_by} · ` : ""}{e.payment_mode} · {formatDate(e.date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-num font-bold text-lg text-red-700">-{formatINR(e.amount)}</div>
                  </div>
                </div>
                {!e.voided && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => nav("/expenses/add", { state: { entry: e } })}
                      data-testid={`exp-edit-${e.id}`}
                      className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1 font-medium text-xs"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setConfirmVoid(e)}
                      data-testid={`exp-void-${e.id}`}
                      className="h-9 px-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center"
                    >
                      <Ban size={14} />
                    </button>
                  </div>
                )}
                {e.voided && (
                  <button
                    onClick={() => setConfirmVoid(e)}
                    data-testid={`exp-unvoid-${e.id}`}
                    className="mt-3 w-full h-9 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-1 font-medium text-xs"
                  >
                    <RotateCcw size={14} /> Restore Expense
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmVoid && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmVoid(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="exp-void-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {confirmVoid.voided ? "Restore Expense?" : "Void Expense?"}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmVoid.voided
                ? `Restore ${confirmVoid.description} (${formatINR(confirmVoid.amount)}) back into totals?`
                : `${confirmVoid.description} (${formatINR(confirmVoid.amount)}) will not be counted in totals but stays in the record.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmVoid(null)} data-testid="exp-void-cancel"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium">Cancel</button>
              <button onClick={doVoid} data-testid="exp-void-confirm"
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
