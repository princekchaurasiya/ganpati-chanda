import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { chandaApi, collectorApi, receiptBookApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Search, MoreVertical, Pencil, Ban, RotateCcw, CheckCircle2, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const MODES = ["All", "Cash", "UPI", "Bank Transfer", "Other"];
const STATUSES = ["All", "Pending", "Collected"];

const shortReceipt = (e) => {
  if (!e.receipt_no) return null;
  const book = e.receipt_book_name || "";
  const prefix = book.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "B";
  return `${prefix}/${String(e.receipt_no).padStart(3, "0")}`;
};

export default function ChandaList() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(STATUSES.includes(params.get("status")) ? params.get("status") : "All");
  const [mode, setMode] = useState(MODES.includes(params.get("mode")) ? params.get("mode") : "All");
  const [collector, setCollector] = useState(params.get("collector") || "All");
  const [bookId, setBookId] = useState(params.get("book") || "All");
  const [rNo, setRNo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(null);

  const load = async () => {
    setLoading(true);
    const [list, cols, bks] = await Promise.all([chandaApi.list(), collectorApi.list(), receiptBookApi.list()]);
    setEntries(list); setCollectors(cols); setBooks(bks);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (showVoided ? true : !e.voided))
      .filter((e) => (status === "All" ? true : e.status === status))
      .filter((e) => (mode === "All" ? true : e.payment_mode === mode))
      .filter((e) => (collector === "All" ? true : e.collector === collector))
      .filter((e) => (bookId === "All" ? true : e.receipt_book_id === bookId))
      .filter((e) => (rNo ? String(e.receipt_no || "") === String(rNo).replace(/^0+/, "") || String(e.receipt_no) === String(rNo) : true))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => {
        if (!q.trim()) return true;
        const qq = q.trim().toLowerCase();
        return e.name.toLowerCase().includes(qq)
          || e.collector.toLowerCase().includes(qq)
          || (e.mobile || "").toLowerCase().includes(qq)
          || (e.receipt_book_name || "").toLowerCase().includes(qq)
          || String(e.receipt_no || "").includes(qq);
      });
  }, [entries, q, status, mode, collector, bookId, rNo, from, to, showVoided]);

  const totalAmount = filtered.filter((e) => !e.voided).reduce((s, e) => s + (e.received_amount || 0), 0);
  const activeFilterCount = [status !== "All", mode !== "All", collector !== "All", bookId !== "All", rNo, from, to].filter(Boolean).length;

  const toggleStatus = async (entry) => {
    const next = entry.status === "Collected" ? "Pending" : "Collected";
    try { await chandaApi.update(entry.id, { status: next }); toast.success(`Marked ${next}`); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Update failed"); }
  };

  const doVoid = async () => {
    if (!confirmVoid) return;
    try {
      if (confirmVoid.voided) { await chandaApi.unvoidEntry(confirmVoid.id); toast.success("Entry restored"); }
      else { await chandaApi.voidEntry(confirmVoid.id); toast.success("Entry voided"); }
      setConfirmVoid(null); load();
    } catch { toast.error("Failed"); }
  };

  const clearFilters = () => { setQ(""); setStatus("All"); setMode("All"); setCollector("All"); setBookId("All"); setRNo(""); setFrom(""); setTo(""); };

  return (
    <div className="space-y-3" data-testid="chanda-list-page">
      <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Chanda List (चंदा सूची)</h1>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, mobile, receipt (B1/001)..."
          data-testid="chanda-search-input"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-sm bg-white"
        />
      </div>

      {/* Filter toggle bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          data-testid="filters-toggle-btn"
          className="flex-1 h-9 px-3 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
        >
          <span>Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}</span>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} data-testid="clear-filters-btn"
            className="h-9 px-3 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 flex items-center gap-1">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card-elevated p-3 space-y-2.5" data-testid="filters-panel">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</div>
            <div className="flex flex-wrap gap-1">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(s)} data-testid={`filter-status-${s.toLowerCase()}`}
                  className={`chip text-xs px-3 py-1 ${status === s ? "chip-active" : ""}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Mode</div>
            <div className="flex flex-wrap gap-1">
              {MODES.map((m) => (
                <button key={m} onClick={() => setMode(m)} data-testid={`filter-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                  className={`chip text-xs px-3 py-1 ${mode === m ? "chip-active" : ""}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Collector</div>
              <select value={collector} onChange={(e) => setCollector(e.target.value)} data-testid="filter-collector-select"
                className="w-full h-9 px-2 rounded-lg border border-slate-300 outline-none bg-white text-sm">
                <option value="All">All Collectors</option>
                {collectors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Receipt Book</div>
              <select value={bookId} onChange={(e) => setBookId(e.target.value)} data-testid="filter-book-select"
                className="w-full h-9 px-2 rounded-lg border border-slate-300 outline-none bg-white text-sm">
                <option value="All">All Books</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Receipt No.</div>
              <input type="number" value={rNo} onChange={(e) => setRNo(e.target.value)} placeholder="e.g. 23"
                data-testid="filter-receipt-no" className="w-full h-9 px-2 rounded-lg border border-slate-300 outline-none bg-white text-sm font-num" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">From</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from-date"
                className="w-full h-9 px-2 rounded-lg border border-slate-300 outline-none bg-white text-sm" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">To</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to-date"
                className="w-full h-9 px-2 rounded-lg border border-slate-300 outline-none bg-white text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)}
              data-testid="filter-show-voided" className="w-4 h-4" />
            Show voided
          </label>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-600">
        <div data-testid="filtered-count"><span className="font-bold text-slate-900">{filtered.length}</span> entries</div>
        <div data-testid="filtered-total">Received: <span className="font-num font-bold text-emerald-700">{formatINR(totalAmount)}</span></div>
      </div>

      {/* Compact list */}
      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-slate-500" data-testid="empty-list">
          कोई एंट्री नहीं मिली<br />
          <span className="text-xs">Try clearing filters or add a new entry</span>
        </div>
      ) : (
        <div className="card-elevated divide-y divide-slate-100" data-testid="chanda-compact-list">
          {filtered.map((e) => {
            const r = shortReceipt(e);
            return (
              <div key={e.id} className={`px-3 py-2 flex items-center gap-2 ${e.voided ? "opacity-60" : ""}`} data-testid={`entry-row-${e.id}`}>
                {r && (
                  <div className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums" data-testid={`entry-receipt-${e.id}`}>
                    {r}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold text-slate-900 truncate ${e.voided ? "line-through" : ""}`}>{e.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {e.collector} · {e.payment_mode} · {formatDate(e.date)}{e.mobile ? ` · ${e.mobile}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-sm text-slate-900">{formatINR(e.status === "Collected" ? (e.received_amount || e.amount) : e.amount)}</div>
                  <span className={`text-[9px] leading-none px-1.5 py-0.5 rounded-full font-semibold inline-block mt-0.5 ${
                    e.voided ? "status-void" : e.status === "Collected" ? "status-collected" : "status-pending"
                  }`}>
                    {e.voided ? "VOID" : e.status === "Collected" ? "✓" : "◔"} {e.voided ? "" : e.status}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid={`row-menu-${e.id}`}
                      className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
                      <MoreVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {!e.voided && (
                      <>
                        <DropdownMenuItem onClick={() => toggleStatus(e)} data-testid={`menu-toggle-${e.id}`}>
                          {e.status === "Collected"
                            ? <><Clock size={14} className="mr-2" /> Mark Pending</>
                            : <><CheckCircle2 size={14} className="mr-2" /> Mark Collected</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => nav("/add", { state: { entry: e } })} data-testid={`menu-edit-${e.id}`}>
                          <Pencil size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmVoid(e)} data-testid={`menu-void-${e.id}`}
                          className="text-red-600 focus:text-red-700 focus:bg-red-50">
                          <Ban size={14} className="mr-2" /> Void Entry
                        </DropdownMenuItem>
                      </>
                    )}
                    {e.voided && (
                      <DropdownMenuItem onClick={() => setConfirmVoid(e)} data-testid={`menu-unvoid-${e.id}`}>
                        <RotateCcw size={14} className="mr-2" /> Restore Entry
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
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
