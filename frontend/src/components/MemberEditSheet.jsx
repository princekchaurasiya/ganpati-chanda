import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { memberApi, chandaApi, transferApi, expenseApi, reimbursementApi } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Check, Pencil, Plus, X, HandCoins, ArrowRightLeft, Receipt } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { k: "collected", l: "Collected" },
  { k: "trf_out", l: "Trf Out" },
  { k: "trf_in", l: "Trf In" },
  { k: "paid", l: "Paid" },
];

export default function MemberEditSheet({ name, focus = "collected", onClose, onSaved }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(focus === "paid" ? "paid" : (TABS.some((t) => t.k === focus) ? focus : "collected"));
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await memberApi.detail(name);
      setData(d);
    } catch {
      toast.error("Member entries load nahi ho payi");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [name]);

  const memberPath = `/members/${encodeURIComponent(name)}`;
  const returnTo = memberPath;

  const goFullEdit = (path, entry) => {
    onClose();
    nav(path, { state: { entry, returnTo } });
  };

  const startAmountEdit = (id, amount) => {
    setEditingId(id);
    setEditAmount(String(Math.round(Number(amount) || 0)));
  };

  const saveAmount = async (kind, entry) => {
    const n = Number(editAmount);
    if (!n || n <= 0) return toast.error("Amount भरें");
    setSaving(true);
    try {
      if (kind === "chanda") {
        const payload = { amount: n };
        if (entry.status === "Collected") payload.received_amount = n;
        await chandaApi.update(entry.id, payload);
      } else if (kind === "transfer") {
        await transferApi.update(entry.id, { amount: n });
      } else if (kind === "expense") {
        const oldPaid = Number(entry.amount_paid || 0);
        const personal = Number(entry.personal_contribution || 0);
        const group = Math.max(0, n - personal);
        const payload = {
          amount_paid: n,
          group_funds_used: group,
          personal_contribution: personal,
        };
        if (Math.abs(Number(entry.total_bill || 0) - oldPaid) < 0.01) {
          payload.total_bill = n;
        } else if (n > Number(entry.total_bill || 0)) {
          payload.total_bill = n;
        }
        await expenseApi.update(entry.id, payload);
      } else if (kind === "reimb") {
        await reimbursementApi.update(entry.id, { amount: n });
      }
      toast.success("Amount updated");
      setEditingId(null);
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Update failed — poori entry Edit se theek karo");
    } finally {
      setSaving(false);
    }
  };

  const chandas = (data?.chandas || []).filter((c) => !c.voided);
  const trfOut = (data?.transfers_out || []).filter((t) => !t.voided);
  const trfIn = (data?.transfers_in || []).filter((t) => !t.voided);
  const expenses = (data?.expenses || []).filter((e) => !e.voided);
  const reimbIn = (data?.reimbursements_in || []).filter((r) => !r.voided);
  const reimbOut = (data?.reimbursements_out || []).filter((r) => !r.voided);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="member-update-sheet">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-slate-200 shrink-0 gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate" data-testid="member-update-title">
              Update {name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Galat amount? Amount pe tap karke badlo. Naam, date, mode ke liye pencil use karo.
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="member-update-close"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-3 shrink-0">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => { setTab(t.k); setEditingId(null); }}
                data-testid={`member-update-tab-${t.k}`}
                className={`flex-1 min-w-[4.5rem] h-9 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.k ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading…</div>
          ) : !data ? (
            <div className="py-10 text-center text-slate-500">Koi entry nahi mili.</div>
          ) : tab === "collected" ? (
            <EntrySection
              empty="Is member ne koi chanda collect nahi kiya."
              addLabel="Add collection"
              onAdd={() => { onClose(); nav("/add", { state: { returnTo, collector: name } }); }}
              icon={<HandCoins size={14} className="text-emerald-700" />}
            >
              {chandas.map((c) => (
                <AmountRow
                  key={c.id}
                  id={c.id}
                  title={c.name}
                  sub={`${formatDate(c.date)} · ${c.payment_mode} · ${c.status}${c.receipt_no ? ` · #${c.receipt_no}` : ""}`}
                  amount={c.status === "Collected" ? (c.received_amount || c.amount) : c.amount}
                  tone="emerald"
                  editing={editingId === c.id}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(c.id, c.status === "Collected" ? (c.received_amount || c.amount) : c.amount)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("chanda", c)}
                  onFullEdit={() => goFullEdit("/add", c)}
                />
              ))}
            </EntrySection>
          ) : tab === "trf_out" ? (
            <EntrySection
              empty="Koi transfer out nahi."
              addLabel="Add transfer"
              onAdd={() => { onClose(); nav("/transfer/add", { state: { returnTo, from_member: name } }); }}
              icon={<ArrowRightLeft size={14} className="text-orange-700" />}
            >
              {trfOut.map((t) => (
                <AmountRow
                  key={t.id}
                  id={t.id}
                  title={`→ ${t.to_member}`}
                  sub={`${formatDate(t.date)}${t.note ? ` · ${t.note}` : ""}`}
                  amount={t.amount}
                  tone="orange"
                  editing={editingId === t.id}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(t.id, t.amount)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("transfer", t)}
                  onFullEdit={() => goFullEdit("/transfer/add", t)}
                />
              ))}
            </EntrySection>
          ) : tab === "trf_in" ? (
            <EntrySection
              empty="Koi transfer in nahi."
              addLabel="Add transfer"
              onAdd={() => { onClose(); nav("/transfer/add", { state: { returnTo, to_member: name } }); }}
              icon={<ArrowRightLeft size={14} className="text-blue-700" />}
            >
              {trfIn.map((t) => (
                <AmountRow
                  key={t.id}
                  id={t.id}
                  title={`← ${t.from_member}`}
                  sub={formatDate(t.date)}
                  amount={t.amount}
                  tone="blue"
                  editing={editingId === t.id}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(t.id, t.amount)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("transfer", t)}
                  onFullEdit={() => goFullEdit("/transfer/add", t)}
                />
              ))}
            </EntrySection>
          ) : (
            <EntrySection
              empty="Koi expense / reimbursement nahi."
              addLabel="Add expense"
              onAdd={() => { onClose(); nav("/expenses/add", { state: { returnTo, paid_by: name } }); }}
              icon={<Receipt size={14} className="text-red-700" />}
            >
              {expenses.map((e) => (
                <AmountRow
                  key={e.id}
                  id={e.id}
                  title={e.description}
                  sub={`${formatDate(e.date)}${e.vendor ? ` · ${e.vendor}` : ""} · paid`}
                  amount={e.amount_paid}
                  tone="red"
                  negative
                  editing={editingId === e.id}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(e.id, e.amount_paid)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("expense", e)}
                  onFullEdit={() => goFullEdit("/expenses/add", e)}
                />
              ))}
              {reimbOut.map((r) => (
                <AmountRow
                  key={r.id}
                  id={r.id}
                  title={`Reimburse → ${r.to_member}`}
                  sub={`${formatDate(r.date)} · ${r.payment_mode}`}
                  amount={r.amount}
                  tone="orange"
                  negative
                  editing={editingId === r.id}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(r.id, r.amount)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("reimb", r)}
                  onFullEdit={() => goFullEdit("/reimburse/add", r)}
                />
              ))}
              {reimbIn.map((r) => (
                <AmountRow
                  key={r.id}
                  id={`in-${r.id}`}
                  title={`Reimburse ← ${r.paid_by}`}
                  sub={`${formatDate(r.date)} · ${r.payment_mode}`}
                  amount={r.amount}
                  tone="emerald"
                  editing={editingId === `in-${r.id}`}
                  editAmount={editAmount}
                  setEditAmount={setEditAmount}
                  saving={saving}
                  onStart={() => startAmountEdit(`in-${r.id}`, r.amount)}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveAmount("reimb", r)}
                  onFullEdit={() => goFullEdit("/reimburse/add", r)}
                />
              ))}
            </EntrySection>
          )}
        </div>
      </div>
    </div>
  );
}

function EntrySection({ empty, addLabel, onAdd, icon, children }) {
  const items = React.Children.toArray(children);
  return (
    <div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">{empty}</div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden bg-white">
          {items}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 w-full h-11 rounded-xl border border-dashed border-teal-400 text-teal-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-teal-50"
      >
        {icon}
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function AmountRow({
  id, title, sub, amount, tone = "slate", negative, editing, editAmount, setEditAmount,
  saving, onStart, onCancel, onSave, onFullEdit,
}) {
  const toneMap = {
    emerald: "text-emerald-700",
    orange: "text-orange-700",
    blue: "text-blue-700",
    red: "text-red-700",
    slate: "text-slate-900",
  };
  return (
    <div className="p-3" data-testid={`member-update-row-${id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
          <div className="text-[11px] text-slate-500 truncate">{sub}</div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={onStart}
            data-testid={`member-update-amount-${id}`}
            className={`font-num font-bold text-sm shrink-0 px-2 py-1 rounded-lg hover:bg-slate-100 ${toneMap[tone]}`}
            title="Tap to change amount"
          >
            {negative ? "-" : ""}{formatINR(amount)}
          </button>
        )}
        <button
          type="button"
          onClick={onFullEdit}
          data-testid={`member-update-edit-${id}`}
          title="Poori entry edit karo"
          className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
        >
          <Pencil size={14} />
        </button>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2" data-testid={`member-update-amount-form-${id}`}>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
              className="w-full h-10 pl-7 pr-3 rounded-lg border border-teal-500 outline-none text-base font-num font-bold"
            />
          </div>
          <button type="button" onClick={onCancel} className="w-10 h-10 rounded-lg border border-slate-300 flex items-center justify-center">
            <X size={16} />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            data-testid={`member-update-amount-save-${id}`}
            className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center disabled:opacity-60"
          >
            <Check size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
