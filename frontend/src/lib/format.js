/** Digits of a rupee search (₹ / Rs. / commas stripped). "14" or "1400". Else null. */
export const parseAmountDigits = (q) => {
  const cleaned = String(q || "")
    .trim()
    .replace(/₹/g, "")
    .replace(/\brs\.?\b/gi, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const intPart = cleaned.split(".")[0].replace(/^0+(?=\d)/, "") || "0";
  return intPart;
};

/** Parse a search box as rupees. Accepts 1400, 1,400, ₹1400, Rs. 1400. Else null. */
export const parseAmountQuery = (q) => {
  const digits = parseAmountDigits(q);
  if (digits == null) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
};

/**
 * Amount search: 14 matches 1400 (prefix while typing).
 * Once 4+ digits (1400), exact only — 14000 is not included.
 */
export const matchesAmount = (q, ...values) => {
  const Q = parseAmountDigits(q);
  if (!Q) return false;
  return values.some((v) => {
    if (v == null) return false;
    const A = String(Math.round(Math.abs(Number(v))));
    if (A === Q) return true;
    if (Q.length >= 4) return false;
    return A.startsWith(Q);
  });
};

export const formatINR = (amount) => {
  const n = Number(amount || 0);
  const body = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return (n < -0.005 ? "-₹" : "₹") + body;
};

export const formatINRDecimal = (amount) => {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDate = (iso) => {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(d,10)} ${months[parseInt(m,10)-1]} ${y}`;
  } catch {
    return iso;
  }
};

export const formatDateTimeIST = (isoTs) => {
  if (!isoTs) return "";
  try {
    const d = new Date(isoTs);
    if (isNaN(d.getTime())) return "";
    // Force Asia/Kolkata regardless of user's device timezone
    const datePart = d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    });
    const timePart = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
    });
    return `${datePart} · ${timePart} IST`;
  } catch {
    return "";
  }
};
