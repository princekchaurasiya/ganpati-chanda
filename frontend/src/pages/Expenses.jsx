import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { expenseApi } from "@/lib/api";
import { formatINR, formatDate, matchesAmount } from "@/lib/format";
import { Pencil, Ban, RotateCcw, Plus, X, Receipt, ChevronRight, FileText, FileSpreadsheet, ArrowLeft } from "lucide-react";
import ListSearch from "@/components/ListSearch";
import { toast } from "sonner";
import { downloadExpensesPDF, downloadExpensesExcel } from "@/lib/exports";
import { mergeEvents, colorForEvent } from "@/lib/events";

const CATEGORIES = ["All", "Mandap", "Murti", "Murti Dye", "Banner", "Decoration", "Police & BMC", "Documents", "Dahi Handi", "Aarti Samagri", "Band Baja", "Materials", "Food", "Rent", "Utilities", "Transport", "Other"];
const MODES = ["All", "Cash", "UPI", "Bank Transfer", "Other"];

const catColor = {
  Mandap: { bg: "bg-indigo-50", text: "text-indigo-700" },
  Murti: { bg: "bg-rose-50", text: "text-rose-700" },
  "Murti Dye": { bg: "bg-amber-50", text: "text-amber-800" },
  Banner: { bg: "bg-yellow-50", text: "text-yellow-700" },
  Decoration: { bg: "bg-pink-50", text: "text-pink-700" },
  "Police & BMC": { bg: "bg-red-50", text: "text-red-700" },
  Documents: { bg: "bg-slate-50", text: "text-slate-700" },
  "Dahi Handi": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Aarti Samagri": { bg: "bg-violet-50", text: "text-violet-700" },
  "Band Baja": { bg: "bg-fuchsia-50", text: "text-fuchsia-700" },
  Materials: { bg: "bg-blue-50", text: "text-blue-700" },
  Food: { bg: "bg-orange-50", text: "text-orange-700" },
  Rent: { bg: "bg-purple-50", text: "text-purple-700" },
  Utilities: { bg: "bg-cyan-50", text: "text-cyan-700" },
  Transport: { bg: "bg-amber-50", text: "text-amber-700" },
  Other: { bg: "bg-slate-100", text: "text-slate-700" },
};

export default function Expenses() {
  const nav = useNavigate();
  const location = useLocation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(location?.state?.initialCat || "All");
  const [mode, setMode] = useState("All");
  const [eventF, setEventF] = useState(location?.state?.initialEvent || "All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [catDetail, setCatDetail] = useState(null); // category name string
  const [payerFocus, setPayerFocus] = useState(null); // drill-down: payer within category

  useEffect(() => { setPayerFocus(null); }, [catDetail]);

  // If arrived via `nav('/expenses', {state:{initialCat}})`, auto-open its category modal
  useEffect(() => {
    if (location?.state?.initialCat) {
      setCat("All"); // keep filter chip on All so entries stay visible
      setCatDetail(location.state.initialCat);
      // clear state so back/forward doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .filter((e) => (eventF === "All" ? true : (e.event || "Ganpati Mandap") === eventF))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => {
        if (!q.trim()) return true;
        const qq = q.trim().toLowerCase();
        return (e.description || "").toLowerCase().includes(qq)
          || (e.paid_by || "").toLowerCase().includes(qq)
          || matchesAmount(q, e.amount_paid, e.total_bill);
      });
  }, [entries, q, cat, mode, eventF, from, to, showVoided]);

  const availableEvents = useMemo(() => mergeEvents(entries.map((e) => e.event).filter(Boolean)), [entries]);

  const totalAmount = filtered.filter((e) => !e.voided).reduce((s, e) => s + (e.amount_paid || 0), 0);
  const totalBill = filtered.filter((e) => !e.voided).reduce((s, e) => s + (e.total_bill || 0), 0);

  // Group filtered active expenses by category
  const byCategory = useMemo(() => {
    const map = {};
    filtered.filter((e) => !e.voided).forEach((e) => {
      const k = e.category || "Other";
      if (!map[k]) map[k] = { count: 0, total: 0, bill: 0, entries: [] };
      map[k].count += 1;
      map[k].total += e.amount_paid || 0;
      map[k].bill += e.total_bill || 0;
      map[k].entries.push(e);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

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

  const clearFilters = () => { setQ(""); setCat("All"); setMode("All"); setEventF("All"); setFrom(""); setTo(""); };

  return (
    <div className="space-y-4" data-testid="expenses-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Expenses (खर्चे)</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { try { downloadExpensesPDF(filtered, byCategory); toast.success("PDF downloaded"); } catch { toast.error("PDF export failed"); } }}
            data-testid="exp-export-pdf-btn"
            title="Category, collection, aur person wala PDF"
            className="h-10 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 text-sm"
          >
            <FileText size={16} /> PDF
          </button>
          <button
            onClick={() => { try { downloadExpensesExcel(filtered, byCategory); toast.success("Excel downloaded"); } catch { toast.error("Excel export failed"); } }}
            data-testid="exp-export-excel-btn"
            title="Category, collection, aur person wala Excel"
            className="h-10 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 text-sm"
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button
            onClick={() => nav("/expenses/add")}
            data-testid="expenses-add-btn"
            className="h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 text-sm"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="Search description, paid-by, amount..."
        testId="expenses-search-input"
        className="h-12 text-base"
      />

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
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Event / Purpose</div>
          <div className="flex flex-wrap gap-1.5" data-testid="exp-filter-event-chips">
            <button onClick={() => setEventF("All")} data-testid="exp-filter-event-all"
              className={`chip ${eventF === "All" ? "chip-active" : ""}`}>All</button>
            {availableEvents.map((ev) => (
              <button key={ev} onClick={() => setEventF(ev)}
                data-testid={`exp-filter-event-${ev.replace(/\s+/g,'-').toLowerCase()}`}
                className={`chip ${eventF === ev ? "chip-active" : ""}`}>{ev}</button>
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
          {totalBill > totalAmount + 0.01 && (
            <span className="ml-2 text-xs text-orange-700">Bill {formatINR(totalBill)}</span>
          )}
        </div>
      </div>

      {/* By Category rollup — tap a row to see full breakdown */}
      {byCategory.length > 0 && (
        <div className="card-elevated overflow-hidden" data-testid="exp-by-category">
          <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>By Category</span>
            <span className="normal-case tracking-normal text-slate-400 font-normal">Tap for details</span>
          </div>
          {byCategory.map(([catName, info]) => {
            const cc = catColor[catName] || catColor.Other;
            return (
              <button
                key={catName}
                type="button"
                onClick={() => setCatDetail(catName)}
                data-testid={`exp-cat-row-${catName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 active:bg-slate-100 text-left"
              >
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cc.bg} ${cc.text} shrink-0`}>{catName}</span>
                <div className="text-xs text-slate-500 shrink-0">{info.count} {info.count === 1 ? "entry" : "entries"}</div>
                <div className="flex-1 text-right font-num font-bold text-red-700">-{formatINR(info.total)}</div>
                <ChevronRight size={14} className="text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

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
                      {e.event && (() => { const cc = colorForEvent(e.event); return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cc.bg} ${cc.text}`} data-testid={`exp-event-badge-${e.id}`}>{e.event}</span>; })()}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {e.vendor ? <span className="text-slate-700 font-medium">{e.vendor} · </span> : null}
                      Paid by <span className="font-medium text-slate-700">{e.paid_by}</span> · {e.payment_mode} · {formatDate(e.date)}
                    </div>
                    {(e.total_bill || 0) > (e.amount_paid || 0) + 0.01 && (
                      <div className="text-[11px] text-orange-700 mt-0.5">
                        Bill Rs.{Math.round(e.total_bill)} · Paid Rs.{Math.round(e.amount_paid)} · Bakaya Rs.{Math.round(e.total_bill - e.amount_paid)}
                      </div>
                    )}
                    {(e.personal_contribution || 0) > 0.01 && (
                      <div className="text-[11px] text-amber-700 mt-0.5">Personal contribution Rs.{Math.round(e.personal_contribution)} (reimbursement due)</div>
                    )}
                    {e.note && <div className="text-[11px] text-slate-500 mt-0.5 italic truncate">"{e.note}"</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-num font-bold text-lg text-red-700">-{formatINR(e.amount_paid || 0)}</div>
                    {(e.total_bill || 0) !== (e.amount_paid || 0) && (
                      <div className="text-[10px] text-slate-500 font-num">bill {formatINR(e.total_bill || 0)}</div>
                    )}
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

      {catDetail && (() => {
        const info = byCategory.find(([k]) => k === catDetail)?.[1];
        if (!info) return null;
        const cc = catColor[catDetail] || catColor.Other;
        const byPayer = {};
        info.entries.forEach((e) => {
          const key = e.paid_by || "-";
          if (!byPayer[key]) byPayer[key] = { count: 0, total: 0, entries: [] };
          byPayer[key].count += 1;
          byPayer[key].total += e.amount_paid || 0;
          byPayer[key].entries.push(e);
        });
        const payerCount = Object.keys(byPayer).length;
        const visibleEntries = payerFocus ? (byPayer[payerFocus]?.entries || []) : info.entries;
        const visibleTotal = payerFocus ? (byPayer[payerFocus]?.total || 0) : info.total;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCatDetail(null)}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="exp-cat-modal">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {payerFocus && (
                    <button onClick={() => setPayerFocus(null)} data-testid="exp-cat-back-btn"
                      className="w-7 h-7 -ml-1 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0">
                      <ArrowLeft size={15} />
                    </button>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cc.bg} ${cc.text} shrink-0`}>{catDetail}</span>
                  {payerFocus ? (
                    <>
                      <span className="text-slate-400 text-xs shrink-0">›</span>
                      <span className="text-sm font-semibold text-slate-800 truncate">{payerFocus}</span>
                      <div className="text-[11px] text-slate-500 shrink-0">· {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}</div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">{payerCount} {payerCount === 1 ? "entry" : "entries"}</div>
                  )}
                </div>
                <button onClick={() => setCatDetail(null)} data-testid="exp-cat-modal-close" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="text-sm text-slate-500">{payerFocus ? `${payerFocus} ka contribution` : "Total Paid"}</div>
                <div className="font-num font-bold text-xl text-red-700" data-testid="exp-cat-total">-{formatINR(visibleTotal)}</div>
              </div>

              <div className="overflow-y-auto flex-1">
                {!payerFocus && (
                  <>
                    <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Kisne kharcha kiya <span className="normal-case tracking-normal text-slate-400 font-normal">· tap for breakdown</span></div>
                    <div className="divide-y divide-slate-50">
                      {Object.entries(byPayer).sort((a, b) => b[1].total - a[1].total).map(([payer, d]) => (
                        <button key={payer} type="button"
                          onClick={() => setPayerFocus(payer)}
                          data-testid={`exp-cat-payer-${payer}`}
                          className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">{payer.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{payer}</div>
                            <div className="text-[11px] text-slate-500">{d.count} {d.count === 1 ? "entry" : "entries"}</div>
                          </div>
                          <div className="font-num font-bold text-red-700 shrink-0">-{formatINR(d.total)}</div>
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className={`px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide ${!payerFocus ? "border-t border-slate-100 mt-1" : ""} ${!payerFocus ? "hidden" : ""}`}>
                  {payerFocus ? `${payerFocus} ki entries` : "Entries"}
                </div>
                <div className={`divide-y divide-slate-50 pb-4 ${!payerFocus ? "hidden" : ""}`}>
                  {visibleEntries.map((e) => (
                    <div key={e.id} className="px-4 py-2.5 flex items-start gap-3" data-testid={`exp-cat-entry-${e.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm truncate">{e.description}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {e.vendor ? <span>{e.vendor} · </span> : null}
                          Paid by <span className="font-medium text-slate-700">{e.paid_by}</span> · {e.payment_mode} · {formatDate(e.date)}
                        </div>
                        {(e.personal_contribution || 0) > 0.01 && (
                          <div className="text-[11px] text-amber-700 mt-0.5">Personal Rs.{Math.round(e.personal_contribution)} (reimburse due)</div>
                        )}
                        {e.note && <div className="text-[11px] text-slate-400 italic truncate">"{e.note}"</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-num font-bold text-red-700">-{formatINR(e.amount_paid || 0)}</div>
                        <button
                          onClick={() => { setCatDetail(null); nav("/expenses/add", { state: { entry: e } }); }}
                          data-testid={`exp-cat-edit-${e.id}`}
                          className="text-[10px] text-teal-700 hover:underline mt-0.5 flex items-center gap-0.5"
                        >
                          <Pencil size={10} /> edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmVoid && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmVoid(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="exp-void-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {confirmVoid.voided ? "Restore Expense?" : "Void Expense?"}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmVoid.voided
                ? `Restore ${confirmVoid.description} (${formatINR(confirmVoid.amount_paid || 0)}) back into totals?`
                : `${confirmVoid.description} (${formatINR(confirmVoid.amount_paid || 0)}) will not be counted in totals but stays in the record.`}
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
