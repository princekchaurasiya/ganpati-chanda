// Shared export helpers for Expenses + Members ledger.
// Uses jsPDF + jspdf-autotable + XLSX (already installed).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatDate, formatDateTimeIST } from "@/lib/format";

const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dt = () => new Date().toISOString().slice(0, 10);

// ---------- EXPENSES ----------
const EXP_COLS = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "event", label: "Event" },
  { key: "vendor", label: "Vendor" },
  { key: "paid_by", label: "Paid By" },
  { key: "payment_mode", label: "Mode" },
  { key: "amount_paid", label: "Paid" },
  { key: "total_bill", label: "Bill" },
];

const expCellText = (e, k) => {
  if (k === "date") return formatDate(e.date);
  if (k === "amount_paid" || k === "total_bill") return e[k] != null ? String(e[k]) : "0";
  if (k === "event") return e.event || "Ganpati Mandap";
  return e[k] || "";
};
const expCellPDF = (e, k) => {
  if (k === "date") return formatDate(e.date);
  if (k === "amount_paid" || k === "total_bill") return formatRs(e[k] || 0);
  if (k === "event") return e.event || "Ganpati Mandap";
  return e[k] || "-";
};

export const exportExpensesPDF = (entries, byCategory, opts = {}) => {
  const active = entries.filter((e) => !e.voided);
  const totalPaid = active.reduce((s, e) => s + (e.amount_paid || 0), 0);
  const totalBill = active.reduce((s, e) => s + (e.total_bill || 0), 0);
  const bakaya = totalBill - totalPaid;

  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Expense Report", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(0);
  const summary = [
    `Total Expenses: ${active.length}`,
    `Total Paid:     ${formatRs(totalPaid)}`,
    `Total Bill:     ${formatRs(totalBill)}`,
    ...(bakaya > 0.01 ? [`Bakaya:         ${formatRs(bakaya)}`] : []),
  ];
  summary.forEach((s, i) => doc.text(s, 14, 32 + i * 6));

  let y = 32 + summary.length * 6 + 4;

  if (byCategory && byCategory.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("By Category:", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Category", "Entries", "Paid"]],
      body: byCategory.map(([cat, info]) => [cat, String(info.count), formatRs(info.total)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 149] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Entries:", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [EXP_COLS.map((c) => c.label)],
    body: active.map((e) => EXP_COLS.map((c) => expCellPDF(e, c.key))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 149] },
    margin: { left: 14, right: 14 },
  });

  return doc;
};

export const downloadExpensesPDF = (entries, byCategory) => {
  const doc = exportExpensesPDF(entries, byCategory);
  doc.save(`expenses-${dt()}.pdf`);
};

export const downloadExpensesExcel = (entries, byCategory) => {
  const active = entries.filter((e) => !e.voided);
  const wb = XLSX.utils.book_new();

  // Sheet 1: By Category
  if (byCategory && byCategory.length) {
    const sumRows = byCategory.map(([cat, info]) => ({
      Category: cat, Entries: info.count, Paid: info.total, Bill: info.bill,
    }));
    const totalPaid = active.reduce((s, e) => s + (e.amount_paid || 0), 0);
    const totalBill = active.reduce((s, e) => s + (e.total_bill || 0), 0);
    sumRows.push({ Category: "TOTAL", Entries: active.length, Paid: totalPaid, Bill: totalBill });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), "By Category");
  }

  // Sheet 2: All Entries
  const rows = active.map((e) => {
    const r = {};
    EXP_COLS.forEach((c) => {
      if (c.key === "amount_paid" || c.key === "total_bill") r[c.label] = e[c.key] || 0;
      else r[c.label] = expCellText(e, c.key);
    });
    r["Note"] = e.note || "";
    return r;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Expenses");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `expenses-${dt()}.xlsx`);
};

// ---------- MEMBERS (Summary + Ledger) ----------
const MEM_COLS = [
  { key: "name", label: "Member" },
  { key: "count_collections", label: "Collections" },
  { key: "total_received", label: "Total Collected" },
  { key: "transferred_out", label: "Trf Out" },
  { key: "transferred_in", label: "Trf In" },
  { key: "paid_to_expenses", label: "Paid to Expenses" },
  { key: "personal_contribution", label: "Personal Contrib" },
  { key: "reimbursement_due", label: "Reimb Due" },
  { key: "current_held", label: "Cash Held" },
];

const memCellNum = (m, k) => (k === "name" ? m.name : Number(m[k] || 0));

const LED_TYPE_LABEL = {
  chanda: "Chanda",
  transfer: "Transfer",
  expense: "Expense",
  reimbursement: "Reimbursement",
};

export const downloadMembersPDF = (members, ledger) => {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Members & Ledger Report", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Member-wise Summary:", 14, 30);
  autoTable(doc, {
    startY: 32,
    head: [MEM_COLS.map((c) => c.label)],
    body: members.map((m) =>
      MEM_COLS.map((c) => (c.key === "name" ? m.name : c.key === "count_collections" ? String(m.count_collections || 0) : formatRs(m[c.key] || 0)))
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 149] },
    margin: { left: 14, right: 14 },
  });

  let y = doc.lastAutoTable.finalY + 6;
  const active = (ledger || []).filter((e) => !e.voided);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Ledger (${active.length} entries):`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["When", "Type", "From", "To / Vendor", "Amount", "Note"]],
    body: active.map((e) => [
      e.created_at ? formatDateTimeIST(e.created_at) : formatDate(e.date),
      LED_TYPE_LABEL[e.type] || e.type,
      e.from_party || "-",
      e.to_party || "-",
      formatRs(e.amount || 0),
      e.note || e.description || "",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 149] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`members-ledger-${dt()}.pdf`);
};

export const downloadMembersExcel = (members, ledger) => {
  const wb = XLSX.utils.book_new();

  const memberRows = members.map((m) => {
    const r = {};
    MEM_COLS.forEach((c) => { r[c.label] = memCellNum(m, c.key); });
    return r;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), "Members");

  const active = (ledger || []).filter((e) => !e.voided);
  const ledgerRows = active.map((e) => ({
    "When (IST)": e.created_at ? formatDateTimeIST(e.created_at) : formatDate(e.date),
    "Date": e.date,
    "Type": LED_TYPE_LABEL[e.type] || e.type,
    "From": e.from_party || "",
    "To / Vendor": e.to_party || "",
    "Amount": Number(e.amount || 0),
    "Status": e.status || "",
    "Payment Mode": e.payment_mode || "",
    "Note": e.note || e.description || "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledgerRows), "Ledger");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `members-ledger-${dt()}.xlsx`);
};
