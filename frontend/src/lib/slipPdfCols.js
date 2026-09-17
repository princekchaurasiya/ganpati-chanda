/** Per-slip columns for one member's Hisab / Chanda PDF (checkbox on member page). */
export const MEMBER_SLIP_PDF_COLS = [
  { key: "date", label: "Date" },
  { key: "name", label: "Donor / Slip" },
  { key: "receipt", label: "Receipt" },
  { key: "book", label: "Book" },
  { key: "amount", label: "Amount" },
  { key: "pending", label: "Pending" },
  { key: "event", label: "Event" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" },
  { key: "collector", label: "Collector" },
];

export const MEMBER_SLIP_PDF_DEFAULT_COLS = ["date", "name", "receipt", "amount", "event", "mode", "status"];
export const MEMBER_SLIP_PDF_COL_KEYS = MEMBER_SLIP_PDF_COLS.map((c) => c.key);
