// Shared export helpers for Expenses + Members ledger.
// Uses jsPDF + jspdf-autotable + XLSX (already installed).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatDate, formatDateTimeIST } from "@/lib/format";
import { memberNet } from "@/lib/memberNet";

const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dt = () => new Date().toISOString().slice(0, 10);

/** Incoming money green, outgoing red, pending (not yet in) amber. */
export const PDF_TONE = {
  in: [4, 120, 87],
  out: [185, 28, 28],
  pending: [180, 83, 9],
};

export const pdfHeadStyles = (tone = "in") => ({
  fillColor: PDF_TONE[tone] || PDF_TONE.in,
  textColor: 255,
  fontStyle: "bold",
});

const paintRupee = (cell, tone) => {
  cell.styles.textColor = PDF_TONE[tone];
  cell.styles.fontStyle = "bold";
};

const pdfRupeeParser = (tone, rupeeCols) => (data) => {
  if (data.section !== "body") return;
  if (rupeeCols.includes(data.column.index)) paintRupee(data.cell, tone);
};

export const pdfInPendingParser = (amountIdx, statusIdx) => (data) => {
  if (data.section !== "body") return;
  const status = String((data.row.raw && data.row.raw[statusIdx]) || "").toLowerCase();
  const pending = status === "pending";
  if (data.column.index === amountIdx) paintRupee(data.cell, pending ? "pending" : "in");
  if (statusIdx != null && data.column.index === statusIdx && pending) paintRupee(data.cell, "pending");
};

const pdfAayaPendingParser = (aayaIdx, pendingIdx) => (data) => {
  if (data.section !== "body") return;
  if (data.column.index === aayaIdx) paintRupee(data.cell, "in");
  if (data.column.index === pendingIdx) paintRupee(data.cell, "pending");
};

const pdfSectionTitle = (doc, title, x, y, tone = "in") => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...(PDF_TONE[tone] || PDF_TONE.in));
  doc.text(title, x, y);
};

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

const groupExpenses = (entries, keyFn) => {
  const map = {};
  entries.forEach((e) => {
    const k = keyFn(e) || "-";
    if (!map[k]) map[k] = { key: k, count: 0, total: 0, bill: 0, entries: [] };
    map[k].count += 1;
    map[k].total += e.amount_paid || 0;
    map[k].bill += e.total_bill || 0;
    map[k].entries.push(e);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
};

const expEventOf = (e) => e.event || "Ganpati Mandap";
const expCatOf = (e) => e.category || "Other";
const expPayerOf = (e) => e.paid_by || "-";

export const exportExpensesPDF = (entries, _byCategory, opts = {}) => {
  const active = (entries || []).filter((e) => !e.voided);
  const totalPaid = active.reduce((s, e) => s + (e.amount_paid || 0), 0);
  const totalBill = active.reduce((s, e) => s + (e.total_bill || 0), 0);
  const bakaya = totalBill - totalPaid;
  const byCategory = groupExpenses(active, expCatOf);
  const byEvent = groupExpenses(active, expEventOf);
  const byPayer = groupExpenses(active, expPayerOf);

  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageW - 14;

  const ensureY = (y, need) => {
    if (y + need > pageH - 14) {
      doc.addPage();
      return 16;
    }
    return y;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.title || "Expense Report", left, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, left, 24);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const summary = [
    `Total expenses: ${active.length}`,
    `Total paid:     ${formatRs(totalPaid)}`,
    `Total bill:     ${formatRs(totalBill)}`,
    ...(bakaya > 0.01 ? [`Bakaya:         ${formatRs(bakaya)}`] : []),
  ];
  summary.forEach((s, i) => {
    doc.setTextColor(...(s.startsWith("Total paid") || s.startsWith("Bakaya") ? PDF_TONE.out : [15, 23, 42]));
    doc.text(s, left, 34 + i * 7);
  });
  let y = 34 + summary.length * 7 + 8;

  const writeSection = (heading, groups, head, rowFn) => {
    y = ensureY(y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_TONE.out);
    doc.text(heading, left, y);
    y += 8;
    if (!groups.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No expenses.", left, y);
      y += 10;
      return;
    }
    groups.forEach((g) => {
      y = ensureY(y, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      const nameLines = doc.splitTextToSize(g.key, pageW - 90);
      doc.text(nameLines, left, y);
      doc.setTextColor(...PDF_TONE.out);
      doc.text(formatRs(g.total), right, y, { align: "right" });
      doc.setTextColor(15, 23, 42);
      y += nameLines.length * 5 + 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${g.count} ${g.count === 1 ? "entry" : "entries"}`, left, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [head],
        body: g.entries.map(rowFn),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: pdfHeadStyles("out"),
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left, right: 14 },
        didParseCell: pdfRupeeParser("out", [head.length - 1]),
      });
      y = doc.lastAutoTable.finalY + 8;
    });
    y += 4;
  };

  writeSection(
    "1. By category (type)",
    byCategory,
    ["Date", "Description", "Paid by", "Paid"],
    (e) => [formatDate(e.date), e.description || "-", e.paid_by || "-", formatRs(e.amount_paid)],
  );
  writeSection(
    "2. By collection / event",
    byEvent,
    ["Date", "Description", "Category", "Paid by", "Paid"],
    (e) => [formatDate(e.date), e.description || "-", expCatOf(e), e.paid_by || "-", formatRs(e.amount_paid)],
  );
  writeSection(
    "3. By person (kisne kharcha kiya)",
    byPayer,
    ["Date", "Description", "Category", "Paid"],
    (e) => [formatDate(e.date), e.description || "-", expCatOf(e), formatRs(e.amount_paid)],
  );

  return doc;
};

export const downloadExpensesPDF = (entries, byCategory) => {
  const doc = exportExpensesPDF(entries, byCategory);
  doc.save(`expenses-${dt()}.pdf`);
};

export const downloadExpensesExcel = (entries, _byCategory) => {
  const active = (entries || []).filter((e) => !e.voided);
  const totalPaid = active.reduce((s, e) => s + (e.amount_paid || 0), 0);
  const totalBill = active.reduce((s, e) => s + (e.total_bill || 0), 0);
  const byCategory = groupExpenses(active, expCatOf);
  const byEvent = groupExpenses(active, expEventOf);
  const byPayer = groupExpenses(active, expPayerOf);
  const wb = XLSX.utils.book_new();

  const catRows = byCategory.map((g) => ({
    Category: g.key, Entries: g.count, Paid: g.total, Bill: g.bill,
  }));
  catRows.push({ Category: "TOTAL", Entries: active.length, Paid: totalPaid, Bill: totalBill });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "By Category");

  const eventRows = byEvent.map((g) => ({
    Event: g.key, Entries: g.count, Paid: g.total,
  }));
  eventRows.push({ Event: "TOTAL", Entries: active.length, Paid: totalPaid });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows), "By Event");

  const payerRows = byPayer.map((g) => ({
    "Paid By": g.key, Entries: g.count, Paid: g.total,
  }));
  payerRows.push({ "Paid By": "TOTAL", Entries: active.length, Paid: totalPaid });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payerRows), "By Payer");

  const rows = active.length ? active.map((e) => {
    const r = {};
    EXP_COLS.forEach((c) => {
      if (c.key === "amount_paid" || c.key === "total_bill") r[c.label] = e[c.key] || 0;
      else r[c.label] = expCellText(e, c.key);
    });
    r.Note = e.note || "";
    return r;
  }) : [{ Date: "", Description: "No expenses" }];
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
    headStyles: pdfHeadStyles("in"),
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const key = MEM_COLS[data.column.index]?.key;
      if (key === "total_received" || key === "transferred_in" || key === "current_held") paintRupee(data.cell, "in");
      if (key === "transferred_out" || key === "paid_to_expenses" || key === "personal_contribution" || key === "reimbursement_due") paintRupee(data.cell, "out");
      if (key === "net_position") {
        const raw = members[data.row.index];
        const net = netOfMember(raw);
        paintRupee(data.cell, net < -0.01 ? "out" : net > 0.01 ? "in" : "in");
        if (Math.abs(net) <= 0.01) data.cell.styles.textColor = [71, 85, 105];
      }
    },
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
    headStyles: pdfHeadStyles("in"),
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;
      const type = String((data.row.raw && data.row.raw[1]) || "").toLowerCase();
      if (type === "chanda") paintRupee(data.cell, "in");
      else if (type === "expense" || type === "reimbursement") paintRupee(data.cell, "out");
    },
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

const netOfMember = (m) => memberNet(m);

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
    if (Number(r.m.reimbursement_received || 0) > 0.01) bits.push(`+${formatRs(r.m.reimbursement_received)} reimb`);
    if (Number(r.m.reimbursement_paid_out || 0) > 0.01) bits.push(`-${formatRs(r.m.reimbursement_paid_out)} reimb`);
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
export const downloadMemberHisabPDF = (name, detail, opts = {}) => {
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
  const includeDonorPromises = !!opts.includeDonorPromises;
  const eventFilter = opts.eventFilter || "Ganpati Mandap";
  const personal = personalChandasForMember(opts.allChandas || [], name, eventFilter, includeDonorPromises);
  doc.setFontSize(8);
  doc.text(
    includeDonorPromises ? `${eventFilter}  ·  Personal + donor promises` : `${eventFilter}  ·  Sirf personal chanda (promise nahi)`,
    left,
    26,
  );

  doc.setFillColor(...bg);
  doc.roundedRect(left, 30, width, 42, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("NET HISAB", left + 6, 38);
  doc.setFontSize(10);
  doc.setTextColor(...fg);
  doc.text(tag, left + 6, 45);
  doc.setFontSize(32);
  doc.text(signedRs(net), left + 6, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const bits = [
    `${formatRs(s.total_received || 0)} received`,
    ...(Number(s.transferred_in || 0) > 0.01 ? [`+${formatRs(s.transferred_in)} in`] : []),
    ...(Number(s.transferred_out || 0) > 0.01 ? [`-${formatRs(s.transferred_out)} out`] : []),
    ...(Number(s.reimbursement_received || 0) > 0.01 ? [`+${formatRs(s.reimbursement_received)} reimb`] : []),
    ...(Number(s.reimbursement_paid_out || 0) > 0.01 ? [`-${formatRs(s.reimbursement_paid_out)} reimb`] : []),
    ...(Number(s.paid_to_expenses || 0) > 0.01 ? [`-${formatRs(s.paid_to_expenses)} paid`] : []),
  ];
  doc.text(doc.splitTextToSize(bits.join("  ·  "), width - 12)[0], left + 6, 68);

  let startY = 80;
  const captionThenTable = (title, head, body, tone, rupeeCols = [], extraParse) => {
    if (!body.length) return;
    const pageH = doc.internal.pageSize.getHeight();
    if (startY + 18 > pageH - 16) {
      doc.addPage();
      startY = 16;
    }
    pdfSectionTitle(doc, title, left, startY, tone);
    autoTable(doc, {
      startY: startY + 3,
      head: [head],
      body,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: pdfHeadStyles(tone),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        pdfRupeeParser(tone, rupeeCols)(data);
        if (extraParse) extraParse(data);
      },
    });
    startY = doc.lastAutoTable.finalY + 8;
  };

  if (personal.length) {
    captionThenTable(
      `Personal chanda (${personal.length})${includeDonorPromises ? " + donor promises" : " — sirf personal"}`,
      ["Date", "Slip", "Receipt", "Aaya", "Pending", "Collector", "Status"],
      personal.map((c) => [
        formatDate(c.date),
        c.name || "-",
        receiptLabel(c),
        formatRs(chandaReceivedAmt(c)),
        formatRs(entryPendingAmt(c)),
        c.collector || "-",
        c.status || "-",
      ]),
      "in",
      [],
      pdfAayaPendingParser(3, 4),
    );
  } else {
    const pageH = doc.internal.pageSize.getHeight();
    if (startY + 12 > pageH - 16) {
      doc.addPage();
      startY = 16;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Koi personal chanda nahi is filter pe.", left, startY);
    startY += 10;
  }

  captionThenTable(
    `Collections (${chandas.length})`,
    ["Date", "Donor", "Receipt", "Amount", "Mode", "Status"],
    chandas.map((c) => [
      formatDate(c.date),
      c.name || "-",
      c.receipt_no != null ? `${c.receipt_book_name || ""} #${c.receipt_no}`.trim() : "-",
      formatRs(c.status === "Collected" ? chandaReceivedAmt(c) : (c.amount || 0)),
      c.payment_mode || "-",
      c.status || "-",
    ]),
    "in",
    [],
    pdfInPendingParser(3, 5),
  );
  captionThenTable(
    `Transferred out (${tOut.length})`,
    ["Date", "To", "Amount", "Note"],
    tOut.map((t) => [formatDate(t.date), t.to_member || "-", formatRs(t.amount), t.note || ""]),
    "out",
    [2],
  );
  captionThenTable(
    `Received from others (${tIn.length})`,
    ["Date", "From", "Amount", "Note"],
    tIn.map((t) => [formatDate(t.date), t.from_member || "-", formatRs(t.amount), t.note || ""]),
    "in",
    [2],
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
    "out",
    [3],
  );
  captionThenTable(
    `Reimbursements paid out (${rOut.length})`,
    ["Date", "To", "Amount", "Note"],
    rOut.map((r) => [formatDate(r.date), r.to_member || "-", formatRs(r.amount), r.note || ""]),
    "out",
    [2],
  );
  captionThenTable(
    `Reimbursements received (${rIn.length})`,
    ["Date", "From", "Amount", "Note"],
    rIn.map((r) => [formatDate(r.date), r.paid_by || r.from_member || "-", formatRs(r.amount), r.note || ""]),
    "in",
    [2],
  );

  if (!personal.length && !chandas.length && !tOut.length && !tIn.length && !expenses.length && !rOut.length && !rIn.length) {
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

export const downloadMemberChandaReportPDF = (name, chandas, opts = {}) => {
  const rows = activeRows(chandas);
  const collected = rows.filter((c) => c.status === "Collected").reduce((s, c) => s + (c.received_amount || c.amount || 0), 0);
  const pending = rows.filter((c) => c.status === "Pending").reduce((s, c) => s + (c.amount || 0), 0);
  const promised = rows.reduce((s, c) => s + (c.amount || 0), 0);
  const includeDonorPromises = !!opts.includeDonorPromises;
  const eventFilter = opts.eventFilter || "Ganpati Mandap";
  const personal = personalChandasForMember(opts.allChandas || [], name, eventFilter, includeDonorPromises);
  const persRecv = personal.reduce((s, c) => s + chandaReceivedAmt(c), 0);
  const persPend = personal.reduce((s, c) => s + entryPendingAmt(c), 0);

  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Chanda report — ${name}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);
  doc.text(
    includeDonorPromises ? `${eventFilter}  ·  Personal + donor promises` : `${eventFilter}  ·  Sirf personal chanda (promise nahi)`,
    14,
    27,
  );
  doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setTextColor(...PDF_TONE.in);
    [
      `Collector book: ${rows.length}  ·  Collected ${formatRs(collected)}`,
      `Personal: ${personal.length}  ·  Aaya ${formatRs(persRecv)}`,
    ].forEach((line, i) => doc.text(line, 14, 35 + i * 6));
    doc.setTextColor(...PDF_TONE.pending);
    doc.setFontSize(10);
    doc.text(`Pending (book) ${formatRs(pending)}  ·  Pending (personal) ${formatRs(persPend)}`, 14, 47);
    let startY = 54;
  if (personal.length) {
    pdfSectionTitle(doc, "Personal chanda", 14, startY, "in");
    autoTable(doc, {
      startY: startY + 3,
      head: [["Date", "Slip", "Receipt", "Aaya", "Pending", "Collector", "Status"]],
      body: personal.map((c) => [
        formatDate(c.date),
        c.name || "-",
        receiptLabel(c),
        formatRs(chandaReceivedAmt(c)),
        formatRs(entryPendingAmt(c)),
        c.collector || "-",
        c.status || "-",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: pdfHeadStyles("in"),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didParseCell: pdfAayaPendingParser(3, 4),
    });
    startY = doc.lastAutoTable.finalY + 10;
  }

  pdfSectionTitle(doc, "Collector book", 14, startY, "in");
  autoTable(doc, {
    startY: startY + 3,
    head: [["Date", "Book", "Receipt", "Donor", "Amount", "Mode", "Status", "Event"]],
    body: rows.length ? rows.map((c) => [
      formatDate(c.date),
      c.receipt_book_name || "-",
      c.receipt_no != null ? String(c.receipt_no) : "-",
      c.name || "-",
      formatRs(c.status === "Collected" ? chandaReceivedAmt(c) : (c.amount || 0)),
      c.payment_mode || "-",
      c.status || "-",
      c.event || "-",
    ]) : [["-", "-", "-", "No collections", "-", "-", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: pdfHeadStyles("in"),
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: pdfInPendingParser(4, 6),
  });
  doc.save(`chanda-${fileSafeName(name)}-${dt()}.pdf`);
};

export const downloadMemberChandaReportExcel = (name, chandas, opts = {}) => {
  const rows = activeRows(chandas);
  const includeDonorPromises = !!opts.includeDonorPromises;
  const eventFilter = opts.eventFilter || "Ganpati Mandap";
  const personal = personalChandasForMember(opts.allChandas || [], name, eventFilter, includeDonorPromises);
  const wb = XLSX.utils.book_new();
  const personalData = personal.length ? personal.map((c) => ({
    Date: c.date,
    Slip: c.name || "",
    Receipt: receiptLabel(c),
    Aaya: chandaReceivedAmt(c),
    Pending: entryPendingAmt(c),
    Collector: c.collector || "",
    Status: c.status || "",
    Event: c.event || "",
  })) : [{ Slip: "Koi personal chanda nahi is filter pe" }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personalData), "Personal chanda");
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Collector book");
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
  doc.setTextColor(...PDF_TONE.out);
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
    headStyles: pdfHeadStyles("out"),
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: pdfRupeeParser("out", [5]),
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

export const MEMBER_CHANDA_LIST_COLS = [
  { key: "received", label: "Aaya", kind: "rollup" },
  { key: "pending", label: "Pending", kind: "rollup" },
  { key: "status", label: "Status", kind: "rollup" },
  { key: "promised", label: "Promised", kind: "rollup" },
  { key: "entries", label: "Entries", kind: "rollup" },
  { key: "collector", label: "Collector", kind: "entry" },
  { key: "date", label: "Date", kind: "entry" },
  { key: "event", label: "Event", kind: "entry" },
  { key: "mode", label: "Mode", kind: "entry" },
  { key: "receipt", label: "Receipt", kind: "entry" },
];

export const MEMBER_CHANDA_LIST_DEFAULT_COLS = ["received", "pending", "status"];

const normName = (s) => String(s || "").toLowerCase().trim();

const chandaReceivedAmt = (c) => Number(c.received_amount != null ? c.received_amount : (c.status === "Collected" ? c.amount : 0)) || 0;

const entryPendingAmt = (c) => Math.max(0, Number(c.amount || 0) - chandaReceivedAmt(c));

/** Slip written in the member's own name (their personal chanda, aaya or pending). */
const isExactMemberSlip = (c, memberName) => {
  const n = normName(memberName);
  const nm = normName(c.name);
  const dm = normName(c.donor_member);
  return nm === n && (!dm || dm === n);
};

/** Linked to the member and money actually received (e.g. "Mintu Bhai" → Mintu). */
const isLinkedReceived = (c, memberName) => {
  const n = normName(memberName);
  return normName(c.donor_member) === n && chandaReceivedAmt(c) > 0.01;
};

/**
 * Collector-book promise linked to the member but not yet received, and the
 * slip name is not the member's own name (e.g. Book 2 "Manoj chaurasiya" ₹501).
 */
const isDonorPromiseSlip = (c, memberName) => {
  const n = normName(memberName);
  if (normName(c.donor_member) !== n) return false;
  if (normName(c.name) === n) return false;
  return chandaReceivedAmt(c) <= 0.01;
};

export const personalChandasForMember = (chandas, memberName, eventFilter, includeDonorPromises = false) => {
  return (chandas || []).filter((c) => {
    if (c.voided) return false;
    const personal = isExactMemberSlip(c, memberName) || isLinkedReceived(c, memberName);
    const promise = includeDonorPromises && isDonorPromiseSlip(c, memberName);
    if (!personal && !promise) return false;
    if (eventFilter && eventFilter !== "All") {
      return (c.event || "Ganpati Mandap") === eventFilter;
    }
    return true;
  });
};

const personalChandaStatus = (promised, received, pending) => {
  if (promised <= 0.01) return "—";
  if (pending <= 0.01) return "Aaya";
  if (received <= 0.01) return "Pending";
  return "Partial";
};

const STATUS_SORT = { Pending: 0, Partial: 1, Aaya: 2, "—": 3 };

const receiptLabel = (c) => {
  if (c.receipt_no == null && !c.receipt_book_name) return "-";
  const book = c.receipt_book_name || "";
  return c.receipt_no != null ? `${book ? `${book} / ` : ""}${c.receipt_no}` : (book || "-");
};

const pendingSlipsFromRows = (rows) => {
  const slips = [];
  (rows || []).forEach((r) => {
    (r.entries || []).forEach((c) => {
      const pend = entryPendingAmt(c);
      if (pend > 0.01) slips.push({ member: r.name, c, pend });
    });
  });
  return slips;
};

export const buildMemberPersonalRows = (members, chandas, eventFilter, includeDonorPromises = false) => {
  const rows = (members || []).map((m) => {
    const entries = personalChandasForMember(chandas, m.name, eventFilter, includeDonorPromises);
    const promised = entries.reduce((s, c) => s + Number(c.amount || 0), 0);
    const received = entries.reduce((s, c) => s + chandaReceivedAmt(c), 0);
    const pending = Math.max(0, promised - received);
    const status = personalChandaStatus(promised, received, pending);
    return { name: m.name, entries, promised, received, pending, status, count: entries.length };
  });
  rows.sort((a, b) => {
    const d = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
    if (d) return d;
    return String(a.name).localeCompare(String(b.name));
  });
  return rows;
};

const selectedColDefs = (selectedCols) => {
  const set = new Set(selectedCols || []);
  return MEMBER_CHANDA_LIST_COLS.filter((c) => set.has(c.key));
};

const rollupCell = (row, key) => {
  if (key === "received") return formatRs(row.received);
  if (key === "pending") return formatRs(row.pending);
  if (key === "promised") return formatRs(row.promised);
  if (key === "entries") return String(row.count);
  if (key === "status") return row.status;
  return "";
};

const entryCell = (c, key) => {
  if (key === "collector") return c.collector || "-";
  if (key === "date") return formatDate(c.date);
  if (key === "event") return c.event || "Ganpati Mandap";
  if (key === "mode") return c.payment_mode || "-";
  if (key === "receipt") return receiptLabel(c);
  return "";
};

export const downloadMemberChandaListPDF = (members, chandas, selectedCols, eventFilter = "All", includeDonorPromises = false) => {
  const cols = selectedColDefs(selectedCols);
  const rollupCols = cols.filter((c) => c.kind === "rollup");
  const entryCols = cols.filter((c) => c.kind === "entry");
  const rows = buildMemberPersonalRows(members, chandas, eventFilter, includeDonorPromises);
  const aaya = rows.filter((r) => r.status === "Aaya").length;
  const partial = rows.filter((r) => r.status === "Partial").length;
  const pendingN = rows.filter((r) => r.status === "Pending").length;
  const totRecv = rows.reduce((s, r) => s + r.received, 0);
  const totPend = rows.reduce((s, r) => s + r.pending, 0);
  const totProm = rows.reduce((s, r) => s + r.promised, 0);
  const slips = pendingSlipsFromRows(rows);

  const doc = new jsPDF({ orientation: "portrait" });
  const pageH = doc.internal.pageSize.getHeight();
  const left = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("Chanda list — members (personal)", left, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const scope = eventFilter === "All" ? "All events (mandap + dahi handi + linked)" : eventFilter;
  const mode = includeDonorPromises
    ? "Personal chanda + donor-book promises"
    : "Sirf personal chanda (donor-book promise nahi)";
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  ·  ${scope}`, left, 22);
  doc.text(mode, left, 27);
  doc.setFontSize(11);
  doc.setTextColor(...PDF_TONE.in);
  doc.text(`Aaya ${aaya}  ·  Partial ${partial}  ·  Pending ${pendingN}`, left, 35);
  doc.setTextColor(...PDF_TONE.in);
  doc.text(`Aaya ${formatRs(totRecv)}`, left, 41);
  const aayaW = doc.getTextWidth(`Aaya ${formatRs(totRecv)}  ·  `);
  doc.setTextColor(...PDF_TONE.pending);
  doc.text(`Pending ${formatRs(totPend)}`, left + aayaW, 41);

  const head = ["Member", ...rollupCols.map((c) => c.label)];
  const body = rows.map((r) => [r.name, ...rollupCols.map((c) => rollupCell(r, c.key))]);
  const totalRow = ["TOTAL", ...rollupCols.map((c) => {
    if (c.key === "received") return formatRs(totRecv);
    if (c.key === "pending") return formatRs(totPend);
    if (c.key === "promised") return formatRs(totProm);
    if (c.key === "entries") return String(rows.reduce((s, r) => s + r.count, 0));
    if (c.key === "status") return "";
    return "";
  })];

  autoTable(doc, {
    startY: 47,
    head: [head],
    body: [...body, totalRow],
    styles: { fontSize: 10, cellPadding: 2.2 },
    headStyles: pdfHeadStyles("in"),
    footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left, right: 14 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.row.index === body.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [226, 232, 240];
      }
      const colKey = data.column.index === 0 ? null : rollupCols[data.column.index - 1]?.key;
      if (colKey === "received") paintRupee(data.cell, "in");
      if (colKey === "pending") paintRupee(data.cell, "pending");
    },
  });

  let y = doc.lastAutoTable.finalY + 10;
  const ensureY = (need) => {
    if (y + need > pageH - 14) {
      doc.addPage();
      y = 16;
    }
  };

  ensureY(22);
  pdfSectionTitle(doc, "Pending kahan se — personal slips", left, y, "pending");
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  if (!slips.length) {
    doc.text("Koi personal pending nahi. Jo table me Aaya hai, woh aa chuka.", left, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Member", "Slip name", "Pending", "Collector", "Receipt", "Date"]],
      body: slips.map((s) => [
        s.member,
        s.c.name || "-",
        formatRs(s.pend),
        s.c.collector || "-",
        receiptLabel(s.c),
        formatDate(s.c.date),
      ]),
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: pdfHeadStyles("pending"),
      margin: { left, right: 14 },
      didParseCell: pdfRupeeParser("pending", [2]),
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (entryCols.length) {
    ensureY(20);
    pdfSectionTitle(doc, "Personal chanda entries", left, y, "in");
    y += 4;
    rows.filter((r) => r.entries.length).forEach((r) => {
      ensureY(36);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${r.name}  ·  Aaya ${formatRs(r.received)}  ·  Pending ${formatRs(r.pending)}`, left, y + 6);
      autoTable(doc, {
        startY: y + 8,
        head: [entryCols.map((c) => c.label)],
        body: r.entries.map((c) => entryCols.map((col) => entryCell(c, col.key))),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: pdfHeadStyles("in"),
        margin: { left, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 6;
    });
  }

  doc.save(`chanda-members-${dt()}.pdf`);
};

export const downloadMemberChandaListExcel = (members, chandas, selectedCols, eventFilter = "All", includeDonorPromises = false) => {
  const cols = selectedColDefs(selectedCols);
  const rollupCols = cols.filter((c) => c.kind === "rollup");
  const entryCols = cols.filter((c) => c.kind === "entry");
  const rows = buildMemberPersonalRows(members, chandas, eventFilter, includeDonorPromises);
  const totRecv = rows.reduce((s, r) => s + r.received, 0);
  const totPend = rows.reduce((s, r) => s + r.pending, 0);
  const totProm = rows.reduce((s, r) => s + r.promised, 0);
  const totEntries = rows.reduce((s, r) => s + r.count, 0);
  const slips = pendingSlipsFromRows(rows);

  const numCell = (row, key) => {
    if (key === "received") return row.received;
    if (key === "pending") return row.pending;
    if (key === "promised") return row.promised;
    if (key === "entries") return row.count;
    if (key === "status") return row.status;
    return "";
  };

  const memberSheet = rows.map((r) => {
    const o = { Member: r.name };
    rollupCols.forEach((c) => { o[c.label] = numCell(r, c.key); });
    return o;
  });
  const total = { Member: "TOTAL" };
  rollupCols.forEach((c) => {
    if (c.key === "received") total[c.label] = totRecv;
    else if (c.key === "pending") total[c.label] = totPend;
    else if (c.key === "promised") total[c.label] = totProm;
    else if (c.key === "entries") total[c.label] = totEntries;
    else total[c.label] = "";
  });
  memberSheet.push(total);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberSheet), "Members");

  if (entryCols.length) {
    const entrySheet = [];
    rows.forEach((r) => {
      r.entries.forEach((c) => {
        const o = { Member: r.name };
        entryCols.forEach((col) => {
          if (col.key === "date") o[col.label] = c.date || "";
          else o[col.label] = entryCell(c, col.key);
        });
        entrySheet.push(o);
      });
    });
    if (!entrySheet.length) entrySheet.push({ Member: "No personal chanda entries" });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entrySheet), "Personal chanda");
  }

  const pendingSheet = slips.length
    ? slips.map((s) => ({
      Member: s.member,
      "Slip name": s.c.name || "",
      Pending: s.pend,
      Collector: s.c.collector || "",
      Receipt: receiptLabel(s.c),
      Date: s.c.date || "",
    }))
    : [{ Member: "Koi personal pending nahi", "Slip name": "", Pending: 0, Collector: "", Receipt: "", Date: "" }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendingSheet), "Pending slips");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `chanda-members-${dt()}.xlsx`);
};

export { collectionsForMember };
