export const formatINR = (amount) => {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
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
