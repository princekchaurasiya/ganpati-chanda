import React, { useEffect, useMemo, useState } from "react";
import { chandaApi, collectorApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ALL_COLS = [
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "collector", label: "Collector" },
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    Promise.all([chandaApi.list(), collectorApi.list()]).then(([e, c]) => {
      setEntries(e); setCollectors(c);
    });
  }, []);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => !e.voided)
      .filter((e) => (status === "All" ? true : e.status === status))
      .filter((e) => (mode === "All" ? true : e.payment_mode === mode))
      .filter((e) => (collector === "All" ? true : e.collector === collector))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true));
  }, [entries, status, mode, collector, from, to]);

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
    return e[k] || "";
  };

  const activeCols = ALL_COLS.filter((c) => selectedCols.includes(c.key));

  const exportPDF = () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Chanda Collection Report", 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);

    // Summary
    doc.setFontSize(11);
    doc.setTextColor(0);
    const summary = [
      `Total Entries: ${totals.count}`,
      `Total Amount: ${formatINR(totals.total)}`,
      `Collected: ${formatINR(totals.collected)}`,
      `Pending: ${formatINR(totals.pending)}`,
    ];
    summary.forEach((s, i) => doc.text(s, 14, 32 + i * 6));

    autoTable(doc, {
      startY: 62,
      head: [activeCols.map((c) => c.label)],
      body: filtered.map((e) => activeCols.map((c) => cellValue(e, c.key))),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`chanda-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF downloaded");
  };

  const exportExcel = () => {
    if (activeCols.length === 0) return toast.error("Select at least 1 column");
    const rows = filtered.map((e) => {
      const row = {};
      activeCols.forEach((c) => { row[c.label] = c.key === "amount" ? e.amount : cellValue(e, c.key); });
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
        const v = c.key === "amount" ? e.amount : cellValue(e, c.key);
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
