import React, { useEffect, useMemo, useState } from "react";
import { chandaApi, collectorApi, memberApi, expenseApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { FileText, FileSpreadsheet, FileDown, Share2, Scale, Receipt } from "lucide-react";
import { downloadMembersHisabPDF, downloadExpensesPDF, downloadExpensesExcel, pdfHeadStyles, PDF_TONE } from "@/lib/exports";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { mergeEvents } from "@/lib/events";

// jsPDF's default Helvetica cannot render ₹ glyph — use "Rs." for PDF only.
const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const ALL_COLS = [
  { key: "receipt_book_name", label: "Book" },
  { key: "receipt_no", label: "Receipt No" },
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "collector", label: "Collector" },
  { key: "event", label: "Event" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
];

const MODES = ["All", "Cash", "UPI", "Bank Transfer", "Other"];
const STATUSES = ["All", "Pending", "Collected"];

export default function Reports() {
  const [entries, setEntries] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [selectedCols, setSelectedCols] = useState(ALL_COLS.map((c) => c.key));
  const [status, setStatus] = useState("All");
  const [mode, setMode] = useState("All");
  const [collector, setCollector] = useState("All");
  const [eventF, setEventF] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    Promise.all([
      chandaApi.list(),
      collectorApi.list(),
      memberApi.summary().catch(() => ({ members: [] })),
      expenseApi.list().catch(() => []),
    ]).then(([e, c, m, x]) => {
      setEntries(e); setCollectors(c); setMembers(m.members || []); setExpenses(x || []);
    });
  }, []);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => !e.voided)
      .filter((e) => (status === "All" ? true : e.status === status))
      .filter((e) => (mode === "All" ? true : e.payment_mode === mode))
      .filter((e) => (collector === "All" ? true : e.collector === collector))
      .filter((e) => (eventF === "All" ? true : (e.event || "Ganpati Mandap") === eventF))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true));
  }, [entries, status, mode, collector, eventF, from, to]);

  const availableEvents = useMemo(() => mergeEvents(entries.map((e) => e.event).filter(Boolean)), [entries]);

  const totals = useMemo(() => {
    const t = filtered.reduce((s, e) => s + e.amount, 0);
    const col = filtered.filter((e) => e.status === "Collected").reduce((s, e) => s + e.amount, 0);
    const pen = filtered.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0);
    return { total: t, collected: col, pending: pen, count: filtered.length };
  }, [filtered]);

  const toggleCol = (k) => {
    setSelectedCols((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  };

  const cellValue = (e, k) => {
    if (k === "amount") return formatINR(e.amount);
    if (k === "date") return formatDate(e.date);
    if (k === "receipt_book_name") return e.receipt_book_name || "";
    if (k === "receipt_no") return e.receipt_no != null ? String(e.receipt_no) : "";
    if (k === "event") return e.event || "Ganpati Mandap";
    return e[k] || "";
  };
  const cellValuePDF = (e, k) => {
    if (k === "amount") return formatRs(e.status === "Collected" ? (e.received_amount != null ? e.received_amount : e.amount) : e.amount);
    if (k === "date") return formatDate(e.date);
    if (k === "receipt_book_name") return e.receipt_book_name || "-";
    if (k === "receipt_no") return e.receipt_no != null ? String(e.receipt_no) : "-";
    if (k === "event") return e.event || "Ganpati Mandap";
    return e[k] || "";
  };

  const activeCols = ALL_COLS.filter((c) => selectedCols.includes(c.key));

  const buildPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Chanda Collection Report", 14, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);

    doc.setFontSize(11);
    const summary = [
      [`Total Entries: ${totals.count}`, [15, 23, 42]],
      [`Total Amount: ${formatRs(totals.total)}`, [15, 23, 42]],
      [`Collected:    ${formatRs(totals.collected)}`, PDF_TONE.in],
      [`Pending:      ${formatRs(totals.pending)}`, PDF_TONE.pending],
    ];
    summary.forEach((s, i) => {
      doc.setTextColor(...s[1]);
      doc.text(s[0], 14, 32 + i * 6);
    });

    const amountIdx = activeCols.findIndex((c) => c.key === "amount");
    const statusIdx = activeCols.findIndex((c) => c.key === "status");
    autoTable(doc, {
      startY: 62,
      head: [activeCols.map((c) => c.label)],
      body: filtered.map((e) => activeCols.map((c) => cellValuePDF(e, c.key))),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 3, textColor: [15, 23, 42] },
      headStyles: pdfHeadStyles("in"),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: activeCols.reduce((acc, c, i) => {
        if (c.key === "amount") acc[i] = { halign: "right", fontStyle: "bold" };
        return acc;
      }, {}),
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const e = filtered[data.row.index];
        const pending = e?.status === "Pending";
        if (amountIdx >= 0 && data.column.index === amountIdx) {
          data.cell.styles.textColor = pending ? PDF_TONE.pending : PDF_TONE.in;
          data.cell.styles.fontStyle = "bold";
        }
        if (statusIdx >= 0 && data.column.index === statusIdx && pending) {
          data.cell.styles.textColor = PDF_TONE.pending;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    return doc;
  };

  const exportPDF = () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const doc = buildPDF();
    doc.save(`chanda-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF downloaded");
  };

  const shareWhatsApp = async () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const doc = buildPDF();
    const filename = `chanda-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    try {
      const blob = doc.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Chanda Collection Report",
          text: `Chanda Report — Total: ${formatRs(totals.total)}, Collected: ${formatRs(totals.collected)}, Pending: ${formatRs(totals.pending)}`,
        });
        toast.success("Shared");
        return;
      }
      // Fallback: download PDF + open WhatsApp with summary text
      doc.save(filename);
      const text = encodeURIComponent(
        `*Chanda Collection Report*\nEntries: ${totals.count}\nTotal: ${formatRs(totals.total)}\nCollected: ${formatRs(totals.collected)}\nPending: ${formatRs(totals.pending)}\n\n(PDF file downloaded — attach it to this WhatsApp chat)`
      );
      window.open(`https://wa.me/?text=${text}`, "_blank");
      toast.info("PDF downloaded — attach it in the WhatsApp window");
    } catch (err) {
      if (err?.name !== "AbortError") toast.error("Share failed");
    }
  };

  const exportExcel = () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const rows = filtered.map((e) => {
      const row = {};
      activeCols.forEach((c) => {
        if (c.key === "amount") row[c.label] = e.amount;
        else if (c.key === "receipt_no") row[c.label] = e.receipt_no != null ? e.receipt_no : "";
        else row[c.label] = cellValue(e, c.key);
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chanda");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `chanda-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel downloaded");
  };

  const exportCSV = () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const header = activeCols.map((c) => c.label).join(",");
    const rows = filtered.map((e) =>
      activeCols.map((c) => {
        let v;
        if (c.key === "amount") v = e.amount;
        else if (c.key === "receipt_no") v = e.receipt_no != null ? e.receipt_no : "";
        else v = cellValue(e, c.key);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `chanda-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("CSV downloaded");
  };

  return (
    <div className="space-y-4" data-testid="reports-page">
      <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Outfit"}}>Reports & Export</h1>

      <section className="card-elevated p-5 space-y-2" data-testid="hisab-export-card">
        <h2 className="font-semibold text-slate-900">Net Hisab — sab members</h2>
        <p className="text-sm text-slate-600">
          Har member plus (extra cash) ya minus (extra kharch) — Abhishek jaisi NET HISAB card, sab ek PDF mein.
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              downloadMembersHisabPDF(members);
              toast.success("Hisab PDF downloaded");
            } catch { toast.error("PDF export failed"); }
          }}
          data-testid="reports-hisab-pdf-btn"
          className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2"
        >
          <Scale size={18} /> Hisab PDF — plus / minus
        </button>
      </section>

      <section className="card-elevated p-5 space-y-2" data-testid="expense-type-export-card">
        <h2 className="font-semibold text-slate-900">Expense report — type / collection / person</h2>
        <p className="text-sm text-slate-600">
          Murti me kitna, Dahi Handi me kitna, kisne kharcha kiya — category, collection, aur person teeno ek PDF/Excel mein.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                downloadExpensesPDF(expenses);
                toast.success("Expense PDF downloaded");
              } catch { toast.error("PDF export failed"); }
            }}
            data-testid="reports-expense-pdf-btn"
            className="h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2"
          >
            <Receipt size={18} /> Expense PDF
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                downloadExpensesExcel(expenses);
                toast.success("Expense Excel downloaded");
              } catch { toast.error("Excel export failed"); }
            }}
            data-testid="reports-expense-excel-btn"
            className="h-12 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} /> Expense Excel
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="card-elevated p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Filters</h2>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} data-testid={`report-status-${s.toLowerCase()}`}
                className={`chip ${status === s ? "chip-active" : ""}`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</div>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button key={m} onClick={() => setMode(m)} data-testid={`report-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`chip ${mode === m ? "chip-active" : ""}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Collector</div>
          <select value={collector} onChange={(e) => setCollector(e.target.value)}
            data-testid="report-collector-select"
            className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white">
            <option value="All">All Collectors</option>
            {collectors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Event / Purpose</div>
          <div className="flex flex-wrap gap-1.5" data-testid="report-event-chips">
            <button onClick={() => setEventF("All")} data-testid="report-event-all"
              className={`chip ${eventF === "All" ? "chip-active" : ""}`}>All</button>
            {availableEvents.map((ev) => (
              <button key={ev} onClick={() => setEventF(ev)}
                data-testid={`report-event-${ev.replace(/\s+/g,'-').toLowerCase()}`}
                className={`chip ${eventF === ev ? "chip-active" : ""}`}>{ev}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="report-from-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="report-to-date"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 outline-none bg-white" />
          </div>
        </div>
      </section>

      {/* Column selection */}
      <section className="card-elevated p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Select Columns</h2>
        <div className="grid grid-cols-2 gap-2">
          {ALL_COLS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedCols.includes(c.key)}
                onChange={() => toggleCol(c.key)}
                data-testid={`col-${c.key}`}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">{c.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="card-elevated p-5">
        <h2 className="font-semibold text-slate-900 mb-2">Preview Summary</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-50 rounded-lg p-2.5"><div className="text-xs text-slate-500">Entries</div><div className="font-bold font-num text-slate-900" data-testid="preview-count">{totals.count}</div></div>
          <div className="bg-slate-50 rounded-lg p-2.5"><div className="text-xs text-slate-500">Total</div><div className="font-bold font-num text-slate-900" data-testid="preview-total">{formatINR(totals.total)}</div></div>
          <div className="bg-emerald-50 rounded-lg p-2.5"><div className="text-xs text-emerald-600">Collected</div><div className="font-bold font-num text-emerald-700">{formatINR(totals.collected)}</div></div>
          <div className="bg-orange-50 rounded-lg p-2.5"><div className="text-xs text-orange-600">Pending</div><div className="font-bold font-num text-orange-700">{formatINR(totals.pending)}</div></div>
        </div>
      </section>

      {/* Export buttons */}
      <section className="card-elevated p-5 space-y-2">
        <h2 className="font-semibold text-slate-900 mb-1">Export</h2>
        <button onClick={exportPDF} data-testid="export-pdf-btn"
          className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2">
          <FileText size={18} /> Download PDF
        </button>
        <button onClick={shareWhatsApp} data-testid="share-whatsapp-btn"
          className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1EBE5A] text-white font-semibold flex items-center justify-center gap-2">
          <Share2 size={18} /> Share PDF on WhatsApp
        </button>
        <button onClick={exportExcel} data-testid="export-excel-btn"
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2">
          <FileSpreadsheet size={18} /> Download Excel (.xlsx)
        </button>
        <button onClick={exportCSV} data-testid="export-csv-btn"
          className="w-full h-12 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-semibold flex items-center justify-center gap-2">
          <FileDown size={18} /> Download CSV
        </button>
      </section>
    </div>
  );
}
