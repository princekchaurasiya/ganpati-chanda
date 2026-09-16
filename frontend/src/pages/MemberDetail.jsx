import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { memberApi, chandaApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { ArrowLeft, HandCoins, ArrowRightLeft, Receipt, Pencil, Gift, ChevronRight, X, FileText, FileSpreadsheet, FileDown, Scale } from "lucide-react";
import { colorForEvent } from "@/lib/events";
import MemberEditSheet from "@/components/MemberEditSheet";
import ChandaSlipFilters from "@/components/ChandaSlipFilters";
import { downloadMemberChandaReportPDF, downloadMemberChandaReportExcel, downloadMemberExpenseReportPDF, downloadMemberExpenseReportExcel, downloadMembersHisabPDF, downloadMemberHisabPDF, personalChandasForMember } from "@/lib/exports";
import { useChandaSlipFilters } from "@/lib/chandaFilters";
import { goRecordHeldKharch } from "@/lib/heldSpend";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const memberNet = (m) => {
  if (!m) return 0;
  if (m.net_position != null) return Number(m.net_position);
  return Number(m.total_received || 0) - Number(m.transferred_out || 0) + Number(m.transferred_in || 0) - Number(m.paid_to_expenses || 0);
};

export default function MemberDetail() {
  const { name } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [allChandas, setAllChandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalKind, setModalKind] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const decodedName = decodeURIComponent(name || "");
  const usedEvents = useMemo(() => (allChandas || []).map((c) => c.event).filter(Boolean), [allChandas]);
  const slipFilters = useChandaSlipFilters(usedEvents);
  const donations = useMemo(
    () => personalChandasForMember(allChandas, decodedName, slipFilters.eventFilter, slipFilters.includeDonorPromises),
    [allChandas, decodedName, slipFilters.eventFilter, slipFilters.includeDonorPromises],
  );
  const anyPersonal = useMemo(
    () => personalChandasForMember(allChandas, decodedName, "All", true).length > 0,
    [allChandas, decodedName],
  );
  const slipOpts = {
    allChandas,
    eventFilter: slipFilters.eventFilter,
    includeDonorPromises: slipFilters.includeDonorPromises,
  };

  const loadDetail = () => {
    Promise.all([
      memberApi.detail(name).catch(() => null),
      chandaApi.list().catch(() => []),
    ]).then(([detail, chandas]) => {
      setData(detail);
      setAllChandas(chandas || []);
    }).finally(() => setLoading(false));
  };

  // Auto-open a specific drill-down modal if the caller passed `state.focus`
  // (e.g. Dashboard SumCell click). Cleared after first render so back-navigation
  // doesn't re-trigger the modal.
  useEffect(() => {
    if (!loading && location?.state?.focus) {
      setModalKind(location.state.focus);
      nav(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    setLoading(true);
    loadDetail();
  }, [name]);

  if (loading) return <div className="pt-10 text-center text-slate-500">Loading…</div>;

  // Neither collector activity nor donor activity
  if (!data && !anyPersonal) {
    return (
      <div className="space-y-4 pb-24" data-testid="member-detail-page">
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="member-back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 truncate" style={{ fontFamily: "Outfit" }}>{name}</h1>
        </div>
        <div className="card-elevated p-6 text-center text-slate-500">Koi transaction nahi mila.</div>
      </div>
    );
  }

  const s = data ? data.summary : null;
  const isPureDonor = !s || (s.count_collections === 0 && s.transferred_out === 0 && s.transferred_in === 0 && s.paid_to_expenses === 0 && s.reimbursement_paid_out === 0 && s.reimbursement_received === 0);
  const donationTotal = donations.reduce((sum, d) => sum + Number(d.received_amount != null ? d.received_amount : (d.status === "Collected" ? d.amount : 0) || 0), 0);
  const liveChandas = (data?.chandas || []).filter((c) => !c.voided);
  const liveTrfOut = (data?.transfers_out || []).filter((t) => !t.voided);
  const liveTrfIn = (data?.transfers_in || []).filter((t) => !t.voided);
  const liveExpenses = (data?.expenses || []).filter((e) => !e.voided);
  const liveReimbIn = (data?.reimbursements_in || []).filter((r) => !r.voided);
  const liveReimbOut = (data?.reimbursements_out || []).filter((r) => !r.voided);

  return (
    <div className="space-y-4 pb-24" data-testid="member-detail-page">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="member-back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 truncate flex-1" style={{ fontFamily: "Outfit" }}>{name}</h1>
          <button
            type="button"
            data-testid="member-detail-hisab-pdf-btn"
            title="Is member ka plus/minus hisab + entries"
            onClick={() => {
              try {
                downloadMemberHisabPDF(decodedName, {
                  ...data,
                  chandas: liveChandas,
                  expenses: liveExpenses,
                  transfers_out: liveTrfOut,
                  transfers_in: liveTrfIn,
                  reimbursements_out: liveReimbOut,
                  reimbursements_in: liveReimbIn,
                }, slipOpts);
                toast.success("Hisab PDF downloaded");
              } catch { toast.error("Export failed"); }
            }}
            className="shrink-0 h-9 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1"
          >
            <Scale size={13} /> Hisab PDF
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="member-detail-reports-btn"
                className="shrink-0 h-9 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center gap-1"
              >
                <FileDown size={13} /> Reports
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const summary = await memberApi.summary();
                    downloadMembersHisabPDF(summary.members || []);
                    toast.success("Hisab PDF downloaded");
                  } catch { toast.error("Export failed"); }
                }}
                data-testid="member-detail-hisab-pdf"
              >
                <Scale size={14} className="mr-2" /> Sab members Hisab PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadMemberChandaReportPDF(decodedName, liveChandas, slipOpts);
                    toast.success("Chanda report PDF downloaded");
                  } catch { toast.error("Export failed"); }
                }}
                data-testid="member-detail-chanda-pdf"
              >
                <FileText size={14} className="mr-2" /> Chanda report PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadMemberChandaReportExcel(decodedName, liveChandas, slipOpts);
                    toast.success("Chanda report Excel downloaded");
                  } catch { toast.error("Export failed"); }
                }}
                data-testid="member-detail-chanda-excel"
              >
                <FileSpreadsheet size={14} className="mr-2" /> Chanda report Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadMemberExpenseReportPDF(decodedName, liveExpenses);
                    toast.success("Expense report PDF downloaded");
                  } catch { toast.error("Export failed"); }
                }}
                data-testid="member-detail-expense-pdf"
              >
                <FileText size={14} className="mr-2" /> Expense report PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadMemberExpenseReportExcel(decodedName, liveExpenses);
                    toast.success("Expense report Excel downloaded");
                  } catch { toast.error("Export failed"); }
                }}
                data-testid="member-detail-expense-excel"
              >
                <FileSpreadsheet size={14} className="mr-2" /> Expense report Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setShowUpdate(true)}
            data-testid="member-detail-update-btn"
            className="shrink-0 h-9 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1"
          >
            <Pencil size={13} /> Update
          </button>
        </div>

      <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-800 flex items-center gap-2" data-testid="member-edit-hint">
        <Pencil size={13} className="shrink-0" /> Galat entry? Kisi bhi row ke pencil icon pe tap karke saare fields (amount, mode, date, etc.) edit karo.
      </div>

      <div className="card-elevated p-4 space-y-2" data-testid="member-slip-filters-card">
        <div className="text-sm font-semibold text-slate-900">Personal chanda filter</div>
        <p className="text-xs text-slate-500">Hisab / Chanda PDF aur Donations Given isi filter se. Donor promise default band.</p>
        <ChandaSlipFilters
          eventFilter={slipFilters.eventFilter}
          includeDonorPromises={slipFilters.includeDonorPromises}
          events={slipFilters.events}
          onEventChange={slipFilters.setEventFilter}
          onPromiseChange={slipFilters.setIncludeDonorPromises}
        />
      </div>

      {/* Donations GIVEN by this person (donor role) */}
      {(donations.length > 0 || anyPersonal) && (
        <section className="card-elevated p-4 bg-amber-50/40 border border-amber-100" data-testid="member-donations-given-section">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-amber-700" />
              <h2 className="font-semibold text-slate-900">Donations Given ({donations.length})</h2>
            </div>
            <div className="font-num font-bold text-amber-700">{formatINR(donationTotal)}</div>
          </div>
          <div className="text-[11px] text-amber-800 mb-2">
            {decodedName} ne khud diye — ye paisa collector ke naam par count hota hai.
          </div>
          {donations.length === 0 ? (
            <div className="text-sm text-slate-500 py-2">Is filter pe koi personal chanda nahi. Donor promise tick karke pending book slips dekho.</div>
          ) : (
          <div className="divide-y divide-amber-100/70">
            {donations.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-donation-given-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${c.voided ? "line-through" : ""}`}>
                    <span className="truncate">to {c.collector}</span>
                    {c.event && (() => { const cc = colorForEvent(c.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-donation-given-event-${c.id}`}>{c.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.receipt_book_name ? <span className="text-teal-700 font-medium">{c.receipt_book_name} #{c.receipt_no} · </span> : null}
                    {formatDate(c.date)} · {c.payment_mode} · {c.status}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-amber-800">{formatINR(c.received_amount || c.amount)}</div>
                  {c.status === "Pending" && <div className="text-[10px] text-orange-600">promised {formatINR(c.amount)}</div>}
                </div>
                {!c.voided && (
                  <button
                    onClick={() => nav("/add", { state: { entry: c } })}
                    data-testid={`edit-donation-given-${c.id}`}
                    title="Edit donation"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-amber-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          )}
          {isPureDonor && (
            <div className="mt-2 text-[11px] text-slate-500 italic">
              Note: {name} sirf donor hai — koi chanda collect nahi kiya, isliye niche member stats sab zero hain.
            </div>
          )}
        </section>
      )}

      {/* Current Held card */}
      {s && !isPureDonor && (
      <button
        type="button"
        onClick={() => setModalKind("held")}
        data-testid="member-held-card"
        className={`card-elevated p-5 w-full text-left hover:brightness-95 active:scale-[0.99] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400 ${memberNet(s) < -0.01 ? "bg-red-50" : memberNet(s) < 0.01 ? "bg-slate-50" : "bg-emerald-50"}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Net hisab</div>
          <ChevronRight size={16} className="text-slate-400" />
        </div>
        <div className={`mt-1 text-4xl font-extrabold font-num tracking-tight ${memberNet(s) < -0.01 ? "text-red-700" : memberNet(s) < 0.01 ? "text-slate-500" : "text-emerald-700"}`} data-testid="member-current-held">
          {memberNet(s) > 0.01 ? "+" : ""}{formatINR(memberNet(s))}
        </div>
        <div className="text-xs text-slate-600 mt-1 font-num">
          {formatINR(s.total_received)} received
          {s.transferred_in > 0 && <> +{formatINR(s.transferred_in)} in</>}
          {s.transferred_out > 0 && <> −{formatINR(s.transferred_out)} out</>}
          {s.paid_to_expenses > 0 && <> −{formatINR(s.paid_to_expenses)} paid</>}
          {Math.abs((s.current_held || 0) - memberNet(s)) > 0.01 && <> · group cash (Cash+GPay) {formatINR(s.current_held)}</>}
        </div>
      </button>
      )}

      {/* Summary grid */}
      {s && !isPureDonor && (
      <div className="grid grid-cols-2 gap-3">
        <MiniCard testid="mini-collected" label="Total Collected" value={formatINR(s.total_received)} sub={`${s.count_collections} entries`} color="emerald" onClick={() => setModalKind("collected")} />
        <MiniCard testid="mini-promised" label="Total Promised" value={formatINR(s.total_promised)} sub={s.total_pending > 0 ? `${formatINR(s.total_pending)} pending` : "All received"} color="teal" onClick={() => setModalKind("promised")} />
        <MiniCard testid="mini-trf-out" label="Transferred Out" value={formatINR(s.transferred_out)} color="orange" onClick={s.transferred_out > 0 ? () => setModalKind("trf_out") : null} />
        <MiniCard testid="mini-trf-in" label="Received From Others" value={formatINR(s.transferred_in)} color="blue" onClick={s.transferred_in > 0 ? () => setModalKind("trf_in") : null} />
        <MiniCard testid="mini-group-paid" label="Group Funds Paid" value={formatINR(s.group_funds_paid || 0)} color="red" onClick={(s.group_funds_paid || 0) > 0 ? () => setModalKind("group_paid") : null} />
        <MiniCard testid="mini-personal" label="Personal Contribution" value={formatINR(s.personal_contribution || 0)} sub={s.reimbursement_due > 0.01 ? `${formatINR(s.reimbursement_due)} due` : "Fully reimbursed"} color="amber" onClick={(s.personal_contribution || 0) > 0 ? () => setModalKind("personal") : null} />
        <MiniCard testid="mini-reimb-in" label="Reimbursement Received" value={formatINR(s.reimbursement_received || 0)} color="emerald" onClick={(s.reimbursement_received || 0) > 0 ? () => setModalKind("reimb_in") : null} />
        <MiniCard testid="mini-held" label="Group cash (Cash+GPay)" value={formatINR(s.current_held)} color={s.current_held < 0 ? "red" : "emerald"} onClick={() => setModalKind("held")} />
      </div>
      )}

      {modalKind && (
        <MemberModal kind={modalKind} name={name} data={data} donations={donations} onClose={() => setModalKind(null)} nav={nav} />
      )}

      {s && s.reimbursement_due > 0.01 && (
        <div className="card-elevated p-4 bg-amber-50 border-amber-200 flex items-center justify-between" data-testid="reimb-due-banner">
          <div>
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Reimbursement Due</div>
            <div className="text-2xl font-extrabold font-num text-amber-900" data-testid="member-reimb-due">{formatINR(s.reimbursement_due)}</div>
          </div>
          <button
            onClick={() => nav("/reimburse/add", { state: { to_member: name, amount: s.reimbursement_due } })}
            data-testid="member-reimburse-btn"
            className="h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
          >
            Reimburse Now
          </button>
        </div>
      )}

      {/* Chanda collections */}
      {liveChandas.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-chandas-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Collections ({liveChandas.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveChandas.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-chanda-row-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${c.voided ? "line-through" : ""}`}>
                    <span className="truncate">{c.name}</span>
                    {c.event && (() => { const cc = colorForEvent(c.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-chanda-event-${c.id}`}>{c.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.receipt_book_name ? <span className="text-teal-700 font-medium">{c.receipt_book_name} #{c.receipt_no} · </span> : null}
                    {formatDate(c.date)} · {c.payment_mode} · {c.status}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-slate-900">{formatINR(c.received_amount)}</div>
                  {c.status === "Pending" && <div className="text-[10px] text-orange-600">promised {formatINR(c.amount)}</div>}
                </div>
                {!c.voided && (
                  <button
                    onClick={() => nav("/add", { state: { entry: c } })}
                    data-testid={`edit-chanda-${c.id}`}
                    title="Edit chanda"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers out */}
      {liveTrfOut.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-out-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Transferred Out ({liveTrfOut.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveTrfOut.map((t) => (
              <div key={t.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-trf-out-row-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${t.voided ? "line-through" : ""}`}>→ {t.to_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700 shrink-0">{formatINR(t.amount)}</div>
                {!t.voided && (
                  <button
                    onClick={() => nav("/transfer/add", { state: { entry: t } })}
                    data-testid={`edit-transfer-${t.id}`}
                    title="Edit transfer"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers in */}
      {liveTrfIn.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-transfers-in-section">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className="text-blue-700" />
            <h2 className="font-semibold text-slate-900">Received From Others ({liveTrfIn.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveTrfIn.map((t) => (
              <div key={t.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-trf-in-row-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${t.voided ? "line-through" : ""}`}>← {t.from_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(t.date)}</div>
                </div>
                <div className="font-num font-bold text-blue-700 shrink-0">{formatINR(t.amount)}</div>
                {!t.voided && (
                  <button
                    onClick={() => nav("/transfer/add", { state: { entry: t } })}
                    data-testid={`edit-transfer-in-${t.id}`}
                    title="Edit transfer"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expenses paid */}
      {liveExpenses.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-expenses-section">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={16} className="text-red-700" />
            <h2 className="font-semibold text-slate-900">Expenses Paid ({liveExpenses.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveExpenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-exp-row-${e.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate flex items-center gap-1 ${e.voided ? "line-through" : ""}`}>
                    <span className="truncate">{e.description}</span>
                    {e.event && (() => { const cc = colorForEvent(e.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`} data-testid={`member-exp-event-${e.id}`}>{e.event}</span>; })()}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-num font-bold text-red-700">-{formatINR(e.amount_paid)}</div>
                  {e.total_bill > e.amount_paid && <div className="text-[10px] text-slate-500">bill {formatINR(e.total_bill)}</div>}
                </div>
                {!e.voided && (
                  <button
                    onClick={() => nav("/expenses/add", { state: { entry: e } })}
                    data-testid={`edit-expense-${e.id}`}
                    title="Edit expense"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Reimbursements received */}
      {liveReimbIn.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-in-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Received ({liveReimbIn.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveReimbIn.map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-reimb-in-row-${r.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${r.voided ? "line-through" : ""}`}>from {r.paid_by}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-emerald-700 shrink-0">+{formatINR(r.amount)}</div>
                {!r.voided && (
                  <button
                    onClick={() => nav("/reimburse/add", { state: { entry: r } })}
                    data-testid={`edit-reimb-in-${r.id}`}
                    title="Edit reimbursement"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reimbursements paid out */}
      {liveReimbOut.length > 0 && (
        <section className="card-elevated p-4" data-testid="member-reimb-out-section">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={16} className="text-orange-700" />
            <h2 className="font-semibold text-slate-900">Reimbursements Paid Out ({liveReimbOut.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {liveReimbOut.map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-2 text-sm" data-testid={`member-reimb-out-row-${r.id}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-slate-900 truncate ${r.voided ? "line-through" : ""}`}>to {r.to_member}</div>
                  <div className="text-xs text-slate-500 truncate">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-num font-bold text-orange-700 shrink-0">-{formatINR(r.amount)}</div>
                {!r.voided && (
                  <button
                    onClick={() => nav("/reimburse/add", { state: { entry: r } })}
                    data-testid={`edit-reimb-out-${r.id}`}
                    title="Edit reimbursement"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showUpdate && (
        <MemberEditSheet
          name={decodeURIComponent(name)}
          focus="collected"
          onClose={() => setShowUpdate(false)}
          onSaved={loadDetail}
        />
      )}
    </div>
  );
}

function MiniCard({ label, value, sub, color, onClick, testid }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  };
  const cls = `rounded-xl p-3 ${map[color] || map.slate}`;
  const body = (
    <>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
        {onClick && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
      </div>
      <div className="text-lg font-extrabold font-num mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testid}
        className={`${cls} block w-full text-left hover:brightness-95 active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-teal-400`}>
        {body}
      </button>
    );
  }
  return <div className={cls} data-testid={testid}>{body}</div>;
}

function MemberModal({ kind, name, data, donations, onClose, nav }) {
  if (!data) return null;
  const s = data.summary;
  const returnTo = `/members/${encodeURIComponent(name)}`;
  const activeChandas = (data.chandas || []).filter((c) => !c.voided);
  const collectedList = activeChandas.filter((c) => c.status === "Collected");
  const pendingList = activeChandas.filter((c) => c.status === "Pending");
  const trfOut = (data.transfers_out || []).filter((t) => !t.voided);
  const trfIn = (data.transfers_in || []).filter((t) => !t.voided);
  const groupPaidExp = (data.expenses || []).filter((e) => !e.voided && (e.group_funds_used || 0) > 0);
  const personalExp = (data.expenses || []).filter((e) => !e.voided && (e.personal_contribution || 0) > 0);
  const reimbIn = (data.reimbursements_in || []).filter((r) => !r.voided);

  let title = "", subtitle = "", body = null;

  if (kind === "collected") {
    title = "Collected Chanda";
    subtitle = `${collectedList.length} entries · ${formatINR(collectedList.reduce((s, c) => s + (c.received_amount || c.amount || 0), 0))}`;
    body = <ChandaList entries={collectedList} nav={nav} onClose={onClose} returnTo={returnTo} />;
  } else if (kind === "promised") {
    title = "All Promised";
    subtitle = `${activeChandas.length} entries · ${formatINR(s.total_promised)} · pending ${formatINR(s.total_pending)}`;
    body = (
      <div>
        {pendingList.length > 0 && (
          <>
            <SectionLabel>Pending · {formatINR(pendingList.reduce((s, c) => s + (c.amount || 0), 0))}</SectionLabel>
            <ChandaList entries={pendingList} nav={nav} onClose={onClose} returnTo={returnTo} />
          </>
        )}
        <SectionLabel>Collected · {formatINR(collectedList.reduce((s, c) => s + (c.received_amount || c.amount || 0), 0))}</SectionLabel>
        <ChandaList entries={collectedList} nav={nav} onClose={onClose} returnTo={returnTo} />
      </div>
    );
  } else if (kind === "trf_out") {
    title = `Transferred Out by ${name}`;
    subtitle = `${trfOut.length} transfers · ${formatINR(trfOut.reduce((s, t) => s + t.amount, 0))}`;
    body = <TransferList entries={trfOut} direction="out" nav={nav} onClose={onClose} returnTo={returnTo} />;
  } else if (kind === "trf_in") {
    title = `Received From Others`;
    subtitle = `${trfIn.length} transfers · ${formatINR(trfIn.reduce((s, t) => s + t.amount, 0))}`;
    body = <TransferList entries={trfIn} direction="in" nav={nav} onClose={onClose} returnTo={returnTo} />;
  } else if (kind === "group_paid") {
    title = "Group Funds Paid";
    subtitle = `${groupPaidExp.length} expenses · ${formatINR(groupPaidExp.reduce((s, e) => s + (e.group_funds_used || 0), 0))}`;
    body = <ExpenseList entries={groupPaidExp} field="group_funds_used" nav={nav} onClose={onClose} returnTo={returnTo} />;
  } else if (kind === "personal") {
    title = "Personal Contribution";
    subtitle = `${personalExp.length} expenses · ${formatINR(personalExp.reduce((s, e) => s + (e.personal_contribution || 0), 0))}${s.reimbursement_due > 0.01 ? ` · ${formatINR(s.reimbursement_due)} due` : ""}`;
    body = <ExpenseList entries={personalExp} field="personal_contribution" nav={nav} onClose={onClose} returnTo={returnTo} />;
  } else if (kind === "reimb_in") {
    title = "Reimbursements Received";
    subtitle = `${reimbIn.length} · ${formatINR(reimbIn.reduce((s, r) => s + r.amount, 0))}`;
    body = (
      <div className="divide-y divide-slate-100">
        {reimbIn.length === 0 ? <div className="p-6 text-center text-slate-500 text-sm">None.</div> :
          reimbIn.map((r) => (
            <div key={r.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-reimb-in-${r.id}`}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">from {r.paid_by}</div>
                <div className="text-[10px] text-slate-500 truncate">{formatDate(r.date)} · {r.payment_mode}{r.note ? ` · ${r.note}` : ""}</div>
              </div>
              <div className="font-num font-bold text-sm text-emerald-700">+{formatINR(r.amount)}</div>
            </div>
          ))}
      </div>
    );
  } else if (kind === "held") {
    const received = s.total_received;
    const held = s.current_held;
    title = "Group cash tally (Cash + GPay)";
    subtitle = `${name}'s unspent group funds — physical nikaal nahi`;
    body = (
      <div className="p-3 space-y-2 text-sm" data-testid="held-tally">
        <TallyRow label="Received (own collections)" amount={received} tone="emerald" />
        {s.transferred_in > 0 && <TallyRow label="+ Received from others" amount={s.transferred_in} tone="blue" />}
        {s.transferred_out > 0 && <TallyRow label="− Transferred out" amount={-s.transferred_out} tone="orange" />}
        {(s.group_funds_paid || 0) > 0 && <TallyRow label="− Group funds paid (expenses)" amount={-(s.group_funds_paid || 0)} tone="red" />}
        {(s.reimbursement_paid_out || 0) > 0 && <TallyRow label="− Reimbursements paid to others" amount={-(s.reimbursement_paid_out || 0)} tone="orange" />}
        <div className={`rounded-xl p-3 flex items-center justify-between mt-2 ${held < 0 ? "bg-red-600" : "bg-teal-600"} text-white`}>
          <span className="font-semibold">Currently Held</span>
          <span className="font-num text-xl font-extrabold">{formatINR(held)}</span>
        </div>
        {held > 0.01 && (
          <button
            type="button"
            onClick={() => goRecordHeldKharch(nav, name, held, returnTo, onClose)}
            data-testid="held-record-kharch-btn"
            className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
          >
            Record group kharch {formatINR(held)}
          </button>
        )}
        <div className="text-[11px] text-slate-500">Cash + GPay dono yahan hain. Kharch ho chuka ho to bill daalo — held without expense 0 nahi hota.</div>
        {donations.length > 0 && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2">
            Note: {name} ne khud {formatINR(donations.reduce((s, d) => s + (d.received_amount || d.amount || 0), 0))} chanda diya — wo alag hai (upper amber card me hai).
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose} data-testid="member-modal">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate" data-testid="member-modal-title">{title}</h3>
            <div className="text-[11px] text-slate-500 truncate" data-testid="member-modal-subtitle">{subtitle}</div>
          </div>
          <button onClick={onClose} data-testid="member-modal-close"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-1">{body}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{children}</div>;
}

function TallyRow({ label, amount, tone }) {
  const toneMap = { emerald: "text-emerald-700", blue: "text-blue-700", orange: "text-orange-700", red: "text-red-700", slate: "text-slate-700" };
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-slate-700">{label}</span>
      <span className={`font-num font-bold ${toneMap[tone] || toneMap.slate}`}>{amount >= 0 ? "+" : ""}{formatINR(amount)}</span>
    </div>
  );
}

function ChandaList({ entries, nav, onClose, returnTo }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No entries.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((c) => {
        const r = c.receipt_no ? `${(c.receipt_book_name || "B").replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}/${String(c.receipt_no).padStart(3, "0")}` : null;
        return (
          <div key={c.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-chanda-${c.id}`}>
            {r && <div className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums">{r}</div>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1">
                <span className="truncate">{c.name}</span>
                {c.event && (() => { const cc = colorForEvent(c.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`}>{c.event}</span>; })()}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {c.receipt_book_name ? <span className="text-teal-700 font-medium">{c.receipt_book_name} #{c.receipt_no} · </span> : null}
                {formatDate(c.date)} · {c.payment_mode} · {c.status}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-num font-bold text-sm text-slate-900">{formatINR(c.status === "Collected" ? (c.received_amount || c.amount) : c.amount)}</div>
              {c.status === "Pending" && <div className="text-[9px] text-orange-600">pending</div>}
            </div>
            <button onClick={() => { onClose(); nav("/add", { state: { entry: c, returnTo } }); }} data-testid={`modal-chanda-edit-${c.id}`}
              className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center" title="Edit">
              <Pencil size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TransferList({ entries, direction, nav, onClose, returnTo }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No transfers.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((t) => (
        <div key={t.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-trf-${t.id}`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {direction === "out" ? <>→ {t.to_member}</> : <>← {t.from_member}</>}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
          </div>
          <div className={`font-num font-bold text-sm shrink-0 ${direction === "out" ? "text-orange-700" : "text-blue-700"}`}>{direction === "out" ? "-" : "+"}{formatINR(t.amount)}</div>
          <button onClick={() => { onClose(); nav("/transfer/add", { state: { entry: t, returnTo } }); }} data-testid={`modal-trf-edit-${t.id}`}
            className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center" title="Edit">
            <Pencil size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ExpenseList({ entries, field, nav, onClose, returnTo }) {
  if (entries.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">No expenses.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((e) => (
        <div key={e.id} className="px-3 py-2 flex items-center gap-2" data-testid={`modal-exp-${e.id}`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1">
              <span className="truncate">{e.description}</span>
              {e.event && (() => { const cc = colorForEvent(e.event); return <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-semibold shrink-0 ${cc.bg} ${cc.text}`}>{e.event}</span>; })()}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {e.vendor ? `${e.vendor} · ` : ""}{formatDate(e.date)} · {e.payment_mode}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-num font-bold text-sm text-red-700">-{formatINR(e[field] || 0)}</div>
            {(e.total_bill || 0) !== (e[field] || 0) && <div className="text-[9px] text-slate-500 font-num">bill {formatINR(e.total_bill)}</div>}
          </div>
          <button onClick={() => { onClose(); nav("/expenses/add", { state: { entry: e, returnTo } }); }} data-testid={`modal-exp-edit-${e.id}`}
            className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center" title="Edit">
            <Pencil size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

