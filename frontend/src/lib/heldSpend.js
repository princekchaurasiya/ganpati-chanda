/** Navigate to Add Expense with group cash (Cash + GPay) prefilled as group_funds_used. */

export function heldSpendState(memberName, heldAmount, returnTo = "/") {
  const amt = Math.round(Number(heldAmount) || 0);
  return {
    paid_by: memberName,
    amount_paid: String(amt),
    group_funds_used: String(amt),
    personal_contribution: "0",
    payment_mode: "UPI",
    total_bill: String(amt),
    held_spend: true,
    note: `${memberName} ke paas ₹${amt.toLocaleString("en-IN")} group cash (Cash + GPay) books par unspent hai. Bill daalo — held khud 0 nahi hota.`,
    returnTo,
  };
}

export function goRecordHeldKharch(nav, memberName, heldAmount, returnTo = "/", onClose) {
  if (onClose) onClose();
  nav("/expenses/add", { state: heldSpendState(memberName, heldAmount, returnTo) });
}
