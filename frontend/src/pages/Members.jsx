import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { memberApi, transferApi, ledgerApi, collectorApi, chandaApi } from "@/lib/api";
import { formatINR, formatDate, formatDateTimeIST } from "@/lib/format";
import { ArrowRightLeft, Ban, HandCoins, Receipt, MoreVertical, Pencil, Trash2, Check, X, RotateCcw, UserPlus, Plus, FileText, FileSpreadsheet, Scale } from "lucide-react";
import { toast } from "sonner";
import { downloadMembersPDF, downloadMembersExcel, downloadMembersHisabPDF, downloadMemberHisabPDF, downloadMemberChandaReportPDF, downloadMemberChandaReportExcel, downloadMemberExpenseReportPDF, downloadMemberExpenseReportExcel, collectionsForMember, downloadMemberChandaListPDF, downloadMemberChandaListExcel, MEMBER_CHANDA_LIST_COLS, MEMBER_CHANDA_LIST_DEFAULT_COLS } from "@/lib/exports";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useChandaSlipFilters, loadChandaSlipFilters } from "@/lib/chandaFilters";
import ChandaSlipFilters from "@/components/ChandaSlipFilters";
import { memberNet } from "@/lib/memberNet";

export default function Members() {
  const nav = useNavigate();
  const [members, setMembers] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("members");
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null); // {collector, currentName, newName}
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(null); // {collector, memberSummary}
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [editSheet, setEditSheet] = useState(null); // { name, focus }
  const [chandas, setChandas] = useState([]);
  const [chandaListCols, setChandaListCols] = useState(MEMBER_CHANDA_LIST_DEFAULT_COLS);
  const usedEvents = useMemo(() => (chandas || []).map((c) => c.event).filter(Boolean), [chandas]);
  const slipFilters = useChandaSlipFilters(usedEvents);

  const load = async () => {
    setLoading(true);
    try {
      const [m, t, l, c, ch] = await Promise.all([
        memberApi.summary(),
        transferApi.list(),
        ledgerApi.get(),
        collectorApi.list().catch(() => []),
        chandaApi.list().catch(() => []),
      ]);
      setMembers(m.members || []);
      setTransfers(t || []);
      setLedger(l.entries || []);
      setCollectors(c || []);
      setChandas(ch || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Members load nahi hua");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const collectorFor = (name) => collectors.find((c) => c.name === name);

  const exportMember = async (name, kind) => {
    try {
      const [detail, allChandas] = await Promise.all([
        memberApi.detail(name),
        chandaApi.list().catch(() => []),
      ]);
      const collected = collectionsForMember(detail, allChandas, name);
      const expenses = detail?.expenses || [];
      const filters = loadChandaSlipFilters();
      const slipOpts = { allChandas, eventFilter: filters.eventFilter, includeDonorPromises: filters.includeDonorPromises };
      if (kind === "hisab-pdf") downloadMemberHisabPDF(name, detail, slipOpts);
      else if (kind === "chanda-pdf") downloadMemberChandaReportPDF(name, collected, slipOpts);
      else if (kind === "chanda-excel") downloadMemberChandaReportExcel(name, collected, slipOpts);
      else if (kind === "expense-pdf") downloadMemberExpenseReportPDF(name, expenses);
      else downloadMemberExpenseReportExcel(name, expenses);
      const labels = {
        "hisab-pdf": "Hisab PDF",
        "chanda-pdf": "Chanda report PDF",
        "chanda-excel": "Chanda report Excel",
        "expense-pdf": "Expense report PDF",
        "expense-excel": "Expense report Excel",
      };
      toast.success(`${labels[kind] || "Report"} downloaded`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Export failed");
    }
  };

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

  const saveRename = async () => {
    if (!renameTarget) return;
    const name = (renameTarget.newName || "").trim();
    if (!name) return toast.error("Name required");
    if (name === renameTarget.collector.name) return setRenameTarget(null);
    try {
      await collectorApi.update(renameTarget.collector.id, name);
      toast.success(`Renamed to ${name} — all past transactions updated`);
      setRenameTarget(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Rename failed");
    }
  };

  const saveNewMember = async () => {
    const nm = (newMemberName || "").trim();
    if (!nm) return toast.error("Name required");
    setSavingMember(true);
    try {
      await collectorApi.create(nm);
      toast.success(`${nm} added`);
      setShowAddMember(false);
      setNewMemberName("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add");
    } finally {
      setSavingMember(false);
    }
  };

  const doDeleteMember = async () => {
    if (!confirmDeleteMember) return;
    const { collector, memberSummary } = confirmDeleteMember;
    const hasTx = memberSummary && (memberSummary.total_received > 0 || memberSummary.transferred_out > 0 || memberSummary.transferred_in > 0 || memberSummary.paid_to_expenses > 0 || memberSummary.reimbursement_paid_out > 0 || memberSummary.reimbursement_received > 0);
    if (hasTx) {
      toast.error("Cannot delete — this member has transactions. Rename instead.");
      setConfirmDeleteMember(null);
      return;
    }
    try {
      await collectorApi.remove(collector.id);
      toast.success(`${collector.name} removed`);
      setConfirmDeleteMember(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div className="space-y-4" data-testid="members-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Members & Ledger</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { try { downloadMembersHisabPDF(members); toast.success("Hisab PDF downloaded"); } catch { toast.error("PDF export failed"); } }}
            data-testid="members-hisab-pdf-btn"
            title="Sab members ka plus/minus hisab bade font mein"
            className="h-10 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 text-sm"
          >
            <Scale size={16} /> Hisab PDF
          </button>
          <button
            onClick={() => { try { downloadMembersPDF(members, ledger); toast.success("PDF downloaded"); } catch { toast.error("PDF export failed"); } }}
            data-testid="members-export-pdf-btn"
            title="Export all members + ledger as PDF"
            className="h-10 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 text-sm"
          >
            <FileText size={16} /> All members PDF
          </button>
          <button
            onClick={() => { try { downloadMembersExcel(members, ledger); toast.success("Excel downloaded"); } catch { toast.error("Excel export failed"); } }}
            data-testid="members-export-excel-btn"
            title="Export all members + ledger as Excel"
            className="h-10 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 text-sm"
          >
            <FileSpreadsheet size={16} /> All members Excel
          </button>
          <button
            onClick={() => { setShowAddMember(true); setNewMemberName(""); }}
            data-testid="members-add-btn"
            className="h-10 px-3 rounded-xl bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold flex items-center gap-1 text-sm"
          >
            <UserPlus size={16} /> Add
          </button>
          <button
            onClick={() => nav("/transfer/add")}
            data-testid="members-transfer-btn"
            className="h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 text-sm"
          >
            <ArrowRightLeft size={16} /> Transfer
          </button>
        </div>
      </div>

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
            <div className="text-xs text-teal-800 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
              Galat collection / transfer / paid amount? Member ke <strong>Update</strong> pe tap karo — naam nahi, entries badlegi.
            </div>
            <div className="card-elevated p-4 space-y-3" data-testid="member-chanda-list-export">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Personal chanda list</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Default: member ka apna chanda jo aaya. Donor promise alag tick — same filter Hisab / Chanda PDF pe bhi lagti hai.
                </p>
              </div>
              <ChandaSlipFilters
                eventFilter={slipFilters.eventFilter}
                includeDonorPromises={slipFilters.includeDonorPromises}
                events={slipFilters.events}
                onEventChange={slipFilters.setEventFilter}
                onPromiseChange={slipFilters.setIncludeDonorPromises}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {MEMBER_CHANDA_LIST_COLS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={chandaListCols.includes(c.key)}
                      onChange={() => setChandaListCols((prev) => (
                        prev.includes(c.key) ? prev.filter((k) => k !== c.key) : [...prev, c.key]
                      ))}
                      data-testid={`chanda-list-col-${c.key}`}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-700">{c.label}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      downloadMemberChandaListPDF(members, chandas, chandaListCols, slipFilters.eventFilter, slipFilters.includeDonorPromises);
                      toast.success("Chanda list PDF downloaded");
                    } catch { toast.error("PDF export failed"); }
                  }}
                  data-testid="members-chanda-list-pdf-btn"
                  className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-1.5 text-sm"
                >
                  <FileText size={16} /> Chanda list PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      downloadMemberChandaListExcel(members, chandas, chandaListCols, slipFilters.eventFilter, slipFilters.includeDonorPromises);
                      toast.success("Chanda list Excel downloaded");
                    } catch { toast.error("Excel export failed"); }
                  }}
                  data-testid="members-chanda-list-excel-btn"
                  className="h-11 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold flex items-center justify-center gap-1.5 text-sm"
                >
                  <FileSpreadsheet size={16} /> Chanda list Excel
                </button>
              </div>
            </div>
            {members.map((m) => {
              const col = collectorFor(m.name);
              return (
                <div
                  key={m.name}
                  className="card-elevated p-4 hover:border-teal-300 transition-colors"
                  data-testid={`member-card-${m.name}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <button
                      onClick={() => nav(`/members/${encodeURIComponent(m.name)}`)}
                      data-testid={`member-open-${m.name}`}
                      className="flex items-center gap-2 min-w-0 text-left flex-1"
                    >
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.count_collections} collections</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSheet({ name: m.name, focus: "collected" })}
                      data-testid={`member-update-btn-${m.name}`}
                      className="shrink-0 h-9 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1"
                    >
                      <Pencil size={13} /> Update
                    </button>
                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="text-xs text-slate-500">Net hisab</div>
                      <div className={`font-num font-bold text-lg ${memberNet(m) < -0.01 ? "text-red-700" : memberNet(m) < 0.01 ? "text-slate-500" : "text-emerald-700"}`}>
                        {memberNet(m) > 0.01 ? "+" : ""}{formatINR(memberNet(m))}
                      </div>
                      {Math.abs((m.current_held || 0) - memberNet(m)) > 0.01 && (
                        <div className="text-[10px] text-slate-500">Group cash (Cash+GPay) {formatINR(m.current_held)}</div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button data-testid={`member-menu-${m.name}`}
                          className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => exportMember(m.name, "hisab-pdf")}
                          data-testid={`member-hisab-pdf-${m.name}`}
                        >
                          <Scale size={14} className="mr-2" /> Hisab PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportMember(m.name, "chanda-pdf")}
                          data-testid={`member-chanda-pdf-${m.name}`}
                        >
                          <FileText size={14} className="mr-2" /> Chanda report PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportMember(m.name, "chanda-excel")}
                          data-testid={`member-chanda-excel-${m.name}`}
                        >
                          <FileSpreadsheet size={14} className="mr-2" /> Chanda report Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportMember(m.name, "expense-pdf")}
                          data-testid={`member-expense-pdf-${m.name}`}
                        >
                          <FileText size={14} className="mr-2" /> Expense report PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportMember(m.name, "expense-excel")}
                          data-testid={`member-expense-excel-${m.name}`}
                        >
                          <FileSpreadsheet size={14} className="mr-2" /> Expense report Excel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setEditSheet({ name: m.name, focus: "collected" })}
                          data-testid={`member-edit-entries-${m.name}`}
                        >
                          <Pencil size={14} className="mr-2" /> Update entries
                        </DropdownMenuItem>
                        {col && (
                          <DropdownMenuItem
                            onClick={() => setRenameTarget({ collector: col, currentName: col.name, newName: col.name })}
                            data-testid={`member-rename-${m.name}`}
                          >
                            <Pencil size={14} className="mr-2" /> Rename member
                          </DropdownMenuItem>
                        )}
                        {col && <DropdownMenuSeparator />}
                        {col && (
                          <DropdownMenuItem
                            onClick={() => setConfirmDeleteMember({ collector: col, memberSummary: m })}
                            data-testid={`member-delete-${m.name}`}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 size={14} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="sm:hidden mb-2 text-right">
                    <div className="text-xs text-slate-500">Net hisab</div>
                    <div className={`font-num font-bold text-lg ${memberNet(m) < -0.01 ? "text-red-700" : memberNet(m) < 0.01 ? "text-slate-500" : "text-emerald-700"}`}>
                      {memberNet(m) > 0.01 ? "+" : ""}{formatINR(memberNet(m))}
                    </div>
                    {Math.abs((m.current_held || 0) - memberNet(m)) > 0.01 && (
                      <div className="text-[10px] text-slate-500">Group cash (Cash+GPay) {formatINR(m.current_held)}</div>
                    )}
                  </div>
                  <div
                    className="w-full grid grid-cols-4 gap-2 text-center text-xs"
                    data-testid={`member-stats-${m.name}`}
                  >
                    {[
                      { k: "collected", label: "Collected", value: formatINR(m.total_received), cls: "text-slate-900" },
                      { k: "trf_out", label: "Trf Out", value: formatINR(m.transferred_out), cls: "text-orange-700" },
                      { k: "trf_in", label: "Trf In", value: formatINR(m.transferred_in), cls: "text-blue-700" },
                      { k: "paid", label: "Paid", value: m.paid_to_expenses > 0.01 ? formatINR(-m.paid_to_expenses) : "—", cls: "text-red-700" },
                    ].map((s) => (
                      <button
                        key={s.k}
                        type="button"
                        onClick={() => setEditSheet({ name: m.name, focus: s.k })}
                        data-testid={`member-stat-${s.k}-${m.name}`}
                        className="rounded-lg py-1 hover:bg-slate-50"
                      >
                        <div className="text-slate-500">{s.label}</div>
                        <div className={`font-num font-bold ${s.cls}`}>{s.value}</div>
                        <div className="text-[9px] text-teal-700 font-medium">tap to edit</div>
                      </button>
                    ))}
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
              );
            })}
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
                      {t.created_at ? formatDateTimeIST(t.created_at) : formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-num font-bold text-lg text-slate-900">{formatINR(t.amount)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button data-testid={`transfer-menu-${t.id}`}
                        className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {!t.voided && (
                        <>
                          <DropdownMenuItem onClick={() => nav("/transfer/add", { state: { entry: t } })} data-testid={`transfer-edit-${t.id}`}>
                            <Pencil size={14} className="mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmVoid(t)} data-testid={`transfer-void-${t.id}`}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50">
                            <Ban size={14} className="mr-2" /> Void
                          </DropdownMenuItem>
                        </>
                      )}
                      {t.voided && (
                        <DropdownMenuItem onClick={() => setConfirmVoid(t)} data-testid={`transfer-unvoid-${t.id}`}>
                          <RotateCcw size={14} className="mr-2" /> Restore
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  e.type === "reimbursement" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {e.type === "chanda" ? <HandCoins size={16} /> : e.type === "transfer" ? <ArrowRightLeft size={16} /> : e.type === "reimbursement" ? <HandCoins size={16} /> : <Receipt size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">{e.type}{e.voided ? " · VOIDED" : ""}</div>
                  <div className={`text-sm font-medium text-slate-900 truncate ${e.voided ? "line-through" : ""}`}>
                    {e.from_party} <span className="text-slate-400 mx-1">→</span> {e.to_party}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {e.created_at ? formatDateTimeIST(e.created_at) : formatDate(e.date)}
                  </div>
                </div>
                <div className={`font-num font-bold ${
                  e.type === "chanda" ? "text-emerald-700" :
                  e.type === "transfer" ? "text-slate-700" :
                  e.type === "reimbursement" ? "text-amber-700" :
                  "text-red-700"
                }`}>
                  {e.type === "expense" ? "-" : ""}{formatINR(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {editSheet && (
        <MemberEditSheet
          name={editSheet.name}
          focus={editSheet.focus}
          onClose={() => setEditSheet(null)}
          onSaved={load}
        />
      )}

      {/* Add member modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="add-member-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserPlus size={18} className="text-teal-700" /> Add New Member
            </h3>
            <p className="text-xs text-slate-500 mb-3">Ye member Kisko-Diya dropdown me select karne ke liye available ho jayega.</p>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveNewMember(); if (e.key === "Escape") setShowAddMember(false); }}
              autoFocus
              placeholder="Member ka naam"
              data-testid="add-member-input"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddMember(false)} data-testid="add-member-cancel"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium flex items-center justify-center gap-1">
                <X size={16} /> Cancel
              </button>
              <button onClick={saveNewMember} disabled={savingMember} data-testid="add-member-save"
                className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
                <Plus size={16} /> {savingMember ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename member modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setRenameTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="rename-member-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Rename Member</h3>
            <p className="text-xs text-slate-500 mb-3">This will rename <strong>{renameTarget.currentName}</strong> across all past chandas, expenses, transfers and reimbursements.</p>
            <input
              type="text"
              value={renameTarget.newName}
              onChange={(e) => setRenameTarget({ ...renameTarget, newName: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenameTarget(null); }}
              autoFocus
              data-testid="rename-member-input"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setRenameTarget(null)} data-testid="rename-cancel-btn"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium flex items-center justify-center gap-1">
                <X size={16} /> Cancel
              </button>
              <button onClick={saveRename} data-testid="rename-save-btn"
                className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-1">
                <Check size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete member modal */}
      {confirmDeleteMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmDeleteMember(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="delete-member-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Member?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Remove <strong>{confirmDeleteMember.collector.name}</strong> from the dropdown list.
              Historical transactions will keep the name but the member will no longer be selectable in new entries.
            </p>
            {confirmDeleteMember.memberSummary && (confirmDeleteMember.memberSummary.total_received > 0 || confirmDeleteMember.memberSummary.paid_to_expenses > 0) && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                ⚠ This member has active transactions. Consider Rename instead of Delete.
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteMember(null)} data-testid="delete-member-cancel"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium">Cancel</button>
              <button onClick={doDeleteMember} data-testid="delete-member-confirm"
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Void transfer modal */}
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
