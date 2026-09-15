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
  { key: "current_held", label: "Group Cash Held" },
  { key: "net_position", label: "Net Hisab" },
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

const netOfMember = (m) => {
  if (!m) return 0;
  if (m.net_position != null) return Number(m.net_position);
  return Number(m.total_received || 0) - Number(m.transferred_out || 0) + Number(m.transferred_in || 0) - Number(m.paid_to_expenses || 0);
};

const memberHasActivity = (m, net) =>
  Math.abs(net) > 0.01
  || Number(m.total_received || 0) > 0.01
  || Number(m.paid_to_expenses || 0) > 0.01
  || Number(m.transferred_out || 0) > 0.01
  || Number(m.transferred_in || 0) > 0.01
  || Number(m.count_collections || 0) > 0;

/** Collective board: every member's plus/minus in large type. */
export const downloadMembersHisabPDF = (members) => {
  const rows = (members || []).map((m) => ({ m, net: netOfMember(m) }));
  const minus = rows.filter((r) => r.net < -0.01).sort((a, b) => a.net - b.net);
  const plus = rows.filter((r) => r.net > 0.01).sort((a, b) => b.net - a.net);
  const settled = rows.filter((r) => Math.abs(r.net) <= 0.01 && memberHasActivity(r.m, r.net))
    .sort((a, b) => String(a.m.name).localeCompare(String(b.m.name)));
  const idle = rows.filter((r) => Math.abs(r.net) <= 0.01 && !memberHasActivity(r.m, r.net));

  const minusTotal = minus.reduce((s, r) => s + r.net, 0);
  const plusTotal = plus.reduce((s, r) => s + r.net, 0);

  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageW - 14;
  const width = right - left;
  let y = 18;

  const ensure = (need) => {
    if (y + need <= pageH - 14) return;
    doc.addPage();
    y = 16;
  };

  const signedRs = (n) => {
    const body = formatRs(Math.abs(n));
    if (n > 0.01) return `+ ${body}`;
    if (n < -0.01) return `- ${body}`;
    return body;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(15, 23, 42);
  doc.text("NET HISAB", left, y);
  y += 9;
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text("Sab members — plus / minus bade font mein", left, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, left, y);
  y += 8;

  const boxH = 28;
  const gap = 5;
  const boxW = (width - gap) / 2;
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(left, y, boxW, boxH, 3, 3, "F");
  doc.setFillColor(209, 250, 229);
  doc.roundedRect(left + boxW + gap, y, boxW, boxH, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28);
  doc.text("MINUS", left + 6, y + 8);
  doc.setFontSize(20);
  doc.text(formatRs(Math.abs(minusTotal)), left + 6, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${minus.length} member  ·  extra kharch / dena`, left + 6, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(4, 120, 87);
  doc.text("PLUS", left + boxW + gap + 6, y + 8);
  doc.setFontSize(20);
  doc.text(formatRs(plusTotal), left + boxW + gap + 6, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${plus.length} member  ·  extra cash unke paas`, left + boxW + gap + 6, y + 24);
  y += boxH + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("MINUS = extra kharch (unhe dena hai).   PLUS = extra cash (unke paas hai).", left, y);
  y += 8;

  const drawSectionLabel = (title, rgb, count) => {
    ensure(12);
    doc.setFillColor(...rgb);
    doc.roundedRect(left, y, width, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`${title}   (${count})`, left + 4, y + 5.5);
    y += 11;
  };

  const drawBigRow = (r, kind) => {
    const h = 28;
    ensure(h + 3);
    const bg = kind === "minus" ? [254, 242, 242] : kind === "plus" ? [236, 253, 245] : [248, 250, 252];
    const fg = kind === "minus" ? [185, 28, 28] : kind === "plus" ? [4, 120, 87] : [71, 85, 105];
    doc.setFillColor(...bg);
    doc.roundedRect(left, y, width, h, 2.5, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const name = doc.splitTextToSize(String(r.m.name || ""), width * 0.52);
    doc.text(name[0], left + 6, y + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("NET HISAB", left + 6, y + 16);

    const bits = [];
    bits.push(`${formatRs(r.m.total_received || 0)} received`);
    if (Number(r.m.transferred_in || 0) > 0.01) bits.push(`+${formatRs(r.m.transferred_in)} in`);
    if (Number(r.m.transferred_out || 0) > 0.01) bits.push(`-${formatRs(r.m.transferred_out)} out`);
    if (Number(r.m.paid_to_expenses || 0) > 0.01) bits.push(`-${formatRs(r.m.paid_to_expenses)} paid`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(bits.join("  ·  "), left + 6, y + 23);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...fg);
    doc.text(signedRs(r.net), right - 6, y + 18, { align: "right" });
    y += h + 3;
  };

  if (minus.length) {
    drawSectionLabel("MINUS — extra kharch / dena", [185, 28, 28], minus.length);
    minus.forEach((r) => drawBigRow(r, "minus"));
    y += 2;
  }
  if (plus.length) {
    drawSectionLabel("PLUS — extra cash unke paas", [4, 120, 87], plus.length);
    plus.forEach((r) => drawBigRow(r, "plus"));
    y += 2;
  }
  if (settled.length) {
    drawSectionLabel("SETTLED — hisab barabar", [100, 116, 139], settled.length);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const names = settled.map((r) => r.m.name).join("   ·   ");
    const lines = doc.splitTextToSize(names, width);
    ensure(lines.length * 6 + 4);
    doc.text(lines, left + 2, y);
    y += lines.length * 6 + 6;
  }
  if (idle.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const names = idle.map((r) => r.m.name).join(", ");
    const lines = doc.splitTextToSize(`No activity: ${names}`, width);
    const need = lines.length * 4 + 2;
    if (y + need <= pageH - 10) {
      doc.setTextColor(148, 163, 184);
      doc.text(lines, left, y);
    }
  }

  if (!minus.length && !plus.length && !settled.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(100, 116, 139);
    doc.text("Koi member hisab nahi mila.", left, y + 10);
  }

  doc.save(`hisab-${dt()}.pdf`);
};

// ---------- PER-MEMBER CHANDA + EXPENSE REPORTS ----------
const fileSafeName = (name) => String(name || "member").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "member";
const activeRows = (list) => (list || []).filter((e) => !e.voided);

const signedRs = (n) => {
  const body = formatRs(Math.abs(n));
  if (n > 0.01) return `+ ${body}`;
  if (n < -0.01) return `- ${body}`;
  return body;
};

/** One member: huge NET HISAB plus/minus, then that person's entries. */
export const downloadMemberHisabPDF = (name, detail) => {
  const s = detail?.summary || { name };
  const net = netOfMember(s);
  const kind = net < -0.01 ? "minus" : net > 0.01 ? "plus" : "settled";
  const fg = kind === "minus" ? [185, 28, 28] : kind === "plus" ? [4, 120, 87] : [71, 85, 105];
  const bg = kind === "minus" ? [254, 226, 226] : kind === "plus" ? [209, 250, 229] : [241, 245, 249];
  const tag = kind === "minus" ? "MINUS — extra kharch / dena" : kind === "plus" ? "PLUS — extra cash unke paas" : "SETTLED — hisab barabar";

  const chandas = activeRows(detail?.chandas);
  const tOut = activeRows(detail?.transfers_out);
  const tIn = activeRows(detail?.transfers_in);
  const expenses = activeRows(detail?.expenses);
  const rOut = activeRows(detail?.reimbursements_out);
  const rIn = activeRows(detail?.reimbursements_in);

  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 14;
  const width = pageW - 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(String(name || ""), width);
  doc.text(titleLines[0], left, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, left, 22);

  doc.setFillColor(...bg);
  doc.roundedRect(left, 28, width, 42, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("NET HISAB", left + 6, 36);
  doc.setFontSize(10);
  doc.setTextColor(...fg);
  doc.text(tag, left + 6, 43);
  doc.setFontSize(32);
  doc.text(signedRs(net), left + 6, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const bits = [
    `${formatRs(s.total_received || 0)} received`,
    ...(Number(s.transferred_in || 0) > 0.01 ? [`+${formatRs(s.transferred_in)} in`] : []),
    ...(Number(s.transferred_out || 0) > 0.01 ? [`-${formatRs(s.transferred_out)} out`] : []),
    ...(Number(s.paid_to_expenses || 0) > 0.01 ? [`-${formatRs(s.paid_to_expenses)} paid`] : []),
  ];
  doc.text(doc.splitTextToSize(bits.join("  ·  "), width - 12)[0], left + 6, 66);

  let startY = 76;
  const captionThenTable = (title, head, body) => {
    if (!body.length) return;
    const pageH = doc.internal.pageSize.getHeight();
    if (startY + 18 > pageH - 16) {
      doc.addPage();
      startY = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, left, startY);
    autoTable(doc, {
      startY: startY + 3,
      head: [head],
      body,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    startY = doc.lastAutoTable.finalY + 8;
  };

  captionThenTable(
    `Collections (${chandas.length})`,
    ["Date", "Donor", "Receipt", "Amount", "Mode", "Status"],
    chandas.map((c) => [
      formatDate(c.date),
      c.name || "-",
      c.receipt_no != null ? `${c.receipt_book_name || ""} #${c.receipt_no}`.trim() : "-",
      formatRs(c.status === "Collected" ? (c.received_amount || c.amount) : c.amount),
      c.payment_mode || "-",
      c.status || "-",
    ]),
  );
  captionThenTable(
    `Transferred out (${tOut.length})`,
    ["Date", "To", "Amount", "Note"],
    tOut.map((t) => [formatDate(t.date), t.to_member || "-", formatRs(t.amount), t.note || ""]),
  );
  captionThenTable(
    `Received from others (${tIn.length})`,
    ["Date", "From", "Amount", "Note"],
    tIn.map((t) => [formatDate(t.date), t.from_member || "-", formatRs(t.amount), t.note || ""]),
  );
  captionThenTable(
    `Expenses (${expenses.length})`,
    ["Date", "Description", "Category", "Paid", "Mode"],
    expenses.map((e) => [
      formatDate(e.date),
      e.description || "-",
      e.category || "-",
      formatRs(e.amount_paid),
      e.payment_mode || "-",
    ]),
  );
  captionThenTable(
    `Reimbursements paid out (${rOut.length})`,
    ["Date", "To", "Amount", "Note"],
    rOut.map((r) => [formatDate(r.date), r.to_member || "-", formatRs(r.amount), r.note || ""]),
  );
  captionThenTable(
    `Reimbursements received (${rIn.length})`,
    ["Date", "From", "Amount", "Note"],
    rIn.map((r) => [formatDate(r.date), r.paid_by || r.from_member || "-", formatRs(r.amount), r.note || ""]),
  );

  if (!chandas.length && !tOut.length && !tIn.length && !expenses.length && !rOut.length && !rIn.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text("Koi entry nahi mili.", left, startY + 4);
  }

  doc.save(`hisab-${fileSafeName(name)}-${dt()}.pdf`);
};

const collectionsForMember = (detail, allChandas, memberName) => {
  const fromDetail = activeRows(detail?.chandas);
  if (fromDetail.length) return fromDetail;
  const n = String(memberName || "").toLowerCase().trim();
  return (allChandas || []).filter((c) => !c.voided && (c.collector || "").toLowerCase().trim() === n);
};

export const downloadMemberChandaReportPDF = (name, chandas) => {
  const rows = activeRows(chandas);
  const collected = rows.filter((c) => c.status === "Collected").reduce((s, c) => s + (c.received_amount || c.amount || 0), 0);
  const pending = rows.filter((c) => c.status === "Pending").reduce((s, c) => s + (c.amount || 0), 0);
  const promised = rows.reduce((s, c) => s + (c.amount || 0), 0);

  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Chanda report — ${name}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  [
    `Entries: ${rows.length}`,
    `Promised: ${formatRs(promised)}`,
    `Collected: ${formatRs(collected)}`,
    `Pending: ${formatRs(pending)}`,
  ].forEach((line, i) => doc.text(line, 14, 32 + i * 6));

  autoTable(doc, {
    startY: 58,
    head: [["Date", "Book", "Receipt", "Donor", "Amount", "Mode", "Status", "Event"]],
    body: rows.length ? rows.map((c) => [
      formatDate(c.date),
      c.receipt_book_name || "-",
      c.receipt_no != null ? String(c.receipt_no) : "-",
      c.name || "-",
      formatRs(c.status === "Collected" ? (c.received_amount || c.amount) : c.amount),
      c.payment_mode || "-",
      c.status || "-",
      c.event || "-",
    ]) : [["-", "-", "-", "No collections", "-", "-", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  doc.save(`chanda-${fileSafeName(name)}-${dt()}.pdf`);
};

export const downloadMemberChandaReportExcel = (name, chandas) => {
  const rows = activeRows(chandas);
  const wb = XLSX.utils.book_new();
  const data = rows.length ? rows.map((c) => ({
    Date: c.date,
    Book: c.receipt_book_name || "",
    "Receipt No": c.receipt_no ?? "",
    Donor: c.name || "",
    Amount: Number(c.status === "Collected" ? (c.received_amount || c.amount) : c.amount || 0),
    Promised: Number(c.amount || 0),
    Received: Number(c.received_amount || 0),
    Mode: c.payment_mode || "",
    Status: c.status || "",
    Event: c.event || "",
  })) : [{ Date: "", Donor: "No collections" }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Chanda");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `chanda-${fileSafeName(name)}-${dt()}.xlsx`);
};

export const downloadMemberExpenseReportPDF = (name, expenses) => {
  const rows = activeRows(expenses);
  const paid = rows.reduce((s, e) => s + (e.amount_paid || 0), 0);
  const bill = rows.reduce((s, e) => s + (e.total_bill || 0), 0);
  const bakaya = bill - paid;

  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Expense report — ${name}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  const summary = [
    `Entries: ${rows.length}`,
    `Total paid: ${formatRs(paid)}`,
    `Total bill: ${formatRs(bill)}`,
    ...(bakaya > 0.01 ? [`Bakaya: ${formatRs(bakaya)}`] : []),
  ];
  summary.forEach((line, i) => doc.text(line, 14, 32 + i * 6));

  autoTable(doc, {
    startY: 32 + summary.length * 6 + 4,
    head: [["Date", "Description", "Category", "Vendor", "Bill", "Paid", "Mode", "Note"]],
    body: rows.length ? rows.map((e) => [
      formatDate(e.date),
      e.description || "-",
      e.category || "-",
      e.vendor || "-",
      formatRs(e.total_bill),
      formatRs(e.amount_paid),
      e.payment_mode || "-",
      e.note || "",
    ]) : [["-", "No expenses", "-", "-", "-", "-", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  doc.save(`expense-${fileSafeName(name)}-${dt()}.pdf`);
};

export const downloadMemberExpenseReportExcel = (name, expenses) => {
  const rows = activeRows(expenses);
  const wb = XLSX.utils.book_new();
  const data = rows.length ? rows.map((e) => ({
    Date: e.date,
    Description: e.description || "",
    Category: e.category || "",
    Vendor: e.vendor || "",
    Bill: Number(e.total_bill || 0),
    Paid: Number(e.amount_paid || 0),
    Mode: e.payment_mode || "",
    Note: e.note || "",
  })) : [{ Date: "", Description: "No expenses" }];
  const paid = rows.reduce((s, e) => s + (e.amount_paid || 0), 0);
  const bill = rows.reduce((s, e) => s + (e.total_bill || 0), 0);
  data.push({ Date: "", Description: "TOTAL", Category: "", Vendor: "", Bill: bill, Paid: paid, Mode: "", Note: "" });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Expenses");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `expense-${fileSafeName(name)}-${dt()}.xlsx`);
};

export { collectionsForMember };
