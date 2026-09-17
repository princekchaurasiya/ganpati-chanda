/** Pocket hisab: collections ± transfers − kharch + reimbursement received. */
export const memberNet = (m) => {
  if (!m) return 0;
  if (m.net_position != null) return Number(m.net_position);
  return (
    Number(m.total_received || 0)
    - Number(m.transferred_out || 0)
    + Number(m.transferred_in || 0)
    - Number(m.paid_to_expenses || 0)
    + Number(m.reimbursement_received || 0)
  );
};
