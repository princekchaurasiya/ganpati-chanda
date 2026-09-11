import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { chandaApi, collectorApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Search, Pencil, Ban, RotateCcw, CheckCircle2, Clock, X } from "lucide-react";
import { toast } from "sonner";

const MODES = ["All", "Cash", "UPI", "Bank Transfer", "Other"];
const STATUSES = ["All", "Pending", "Collected"];

export default function ChandaList() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(STATUSES.includes(params.get("status")) ? params.get("status") : "All");
  const [mode, setMode] = useState(MODES.includes(params.get("mode")) ? params.get("mode") : "All");
  const [collector, setCollector] = useState(params.get("collector") || "All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(null);

  const load = async () => {
    setLoading(true);
    const [list, cols] = await Promise.all([chandaApi.list(), collectorApi.list()]);
    setEntries(list);
    setCollectors(cols);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (showVoided ? true : !e.voided))
      .filter((e) => (status === "All" ? true : e.status === status))
      .filter((e) => (mode === "All" ? true : e.payment_mode === mode))
      .filter((e) => (collector === "All" ? true : e.collector === collector))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => {
        if (!q.trim()) return true;
        const qq = q.trim().toLowerCase();
        return e.name.toLowerCase().includes(qq) || e.collector.toLowerCase().includes(qq);
      });
  }, [entries, q, status, mode, collector, from, to, showVoided]);

  const totalAmount = filtered.filter((e) => !e.voided).reduce((s, e) => s + e.amount, 0);

  const toggleStatus = async (entry) => {
    const next = entry.status === "Collected" ? "Pending" : "Collected";
    try {
      await chandaApi.update(entry.id, { status: next });
      toast.success(`Marked ${next}`);
      load();
    } catch {
      toast.error("Update failed");
    }
  };

  const doVoid = async () => {
    if (!confirmVoid) return;
    try {
      if (confirmVoid.voided) {
        await chandaApi.unvoidEntry(confirmVoid.id);
        toast.success("Entry restored");
      } else {
        await chandaApi.voidEntry(confirmVoid.id);
        toast.success("Entry voided");
      }
      setConfirmVoid(null);
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const clearFilters = () => { setQ(""); setStatus("All"); setMode("All"); setCollector("All"); setFrom(""); setTo(""); };

  return (
    <div className="space-y-4" data-testid="chanda-list-page">
      <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Outfit"}}>Chanda List (चंदा सूची)</h1>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or collector"
          data-testid="chanda-search-input"
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base bg-white"
        />
      </div>

      {/* Filter chips */}
      <div className="card-elevated p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} data-testid={`filter-status-${s.toLowerCase()}`}
                className={`chip ${status === s ? "chip-active" : ""}`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</div>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button key={m} onClick={() => setMode(m)} data-testid={`filter-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`chip ${mode === m ? "chip-active" : ""}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Collector</div>
          <select value={collector} onChange={(e) => setCollector(e.target.value)}
            data-testid="filter-collector-select"
            className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white">
            <option value="All">All Collectors</option>
            {collectors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)}
              data-testid="filter-show-voided" className="w-4 h-4" />
            Show voided
          </label>
          <button onClick={clearFilters} data-testid="clear-filters-btn"
            className="text-sm font-medium text-teal-700 flex items-center gap-1 hover:underline">
            <X size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-1 text-sm text-slate-600">
        <div data-testid="filtered-count">
          <span className="font-bold text-slate-900">{filtered.length}</span> entries
        </div>
        <div data-testid="filtered-total">
          Total: <span className="font-num font-bold text-slate-900">{formatINR(totalAmount)}</span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-slate-500" data-testid="empty-list">
          कोई एंट्री नहीं मिली<br />
          <span className="text-xs">Try clearing filters or add a new entry</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => (
            <div key={e.id} className={`card-elevated p-4 ${e.voided ? "opacity-70" : ""}`} data-testid={`entry-card-${e.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`font-semibold text-slate-900 truncate ${e.voided ? "line-through" : ""}`}>{e.name}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      e.voided ? "status-void" : e.status === "Collected" ? "status-collected" : "status-pending"
                    }`}>
                      {e.voided ? "VOID" : e.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {e.collector} · {e.payment_mode} · {formatDate(e.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num font-bold text-lg text-slate-900">{formatINR(e.amount)}</div>
                </div>
              </div>
              {!e.voided && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleStatus(e)}
                    data-testid={`toggle-status-${e.id}`}
                    className={`flex-1 h-9 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-colors ${
                      e.status === "Collected"
                        ? "bg-orange-50 text-orange-700 hover:bg-orange-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {e.status === "Collected" ? <><Clock size={14} /> Mark Pending</> : <><CheckCircle2 size={14} /> Mark Collected</>}
                  </button>
                  <button
                    onClick={() => nav("/add", { state: { entry: e } })}
                    data-testid={`edit-btn-${e.id}`}
                    className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmVoid(e)}
                    data-testid={`void-btn-${e.id}`}
                    className="h-9 px-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center"
                  >
                    <Ban size={14} />
                  </button>
                </div>
              )}
              {e.voided && (
                <div className="mt-3">
                  <button
                    onClick={() => setConfirmVoid(e)}
                    data-testid={`unvoid-btn-${e.id}`}
                    className="w-full h-9 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-1 font-medium text-xs"
                  >
                    <RotateCcw size={14} /> Restore Entry
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Void confirm modal */}
      {confirmVoid && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmVoid(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="void-confirm-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {confirmVoid.voided ? "Restore Entry?" : "Void Entry?"}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmVoid.voided
                ? `Restore ${confirmVoid.name} (${formatINR(confirmVoid.amount)}) back into totals?`
                : `${confirmVoid.name} (${formatINR(confirmVoid.amount)}) will not be counted in totals but stays in the record.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmVoid(null)} data-testid="void-cancel-btn"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium">Cancel</button>
              <button onClick={doVoid} data-testid="void-confirm-btn"
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
