import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { chandaApi, collectorApi, receiptBookApi } from "@/lib/api";
import { todayISO, formatINR } from "@/lib/format";
import { Save, ArrowLeft, User, IndianRupee, Calendar as CalIcon, Phone, BookOpen, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [101, 251, 501, 1100, 2100, 5100];
const MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

export default function AddChanda() {
  const nav = useNavigate();
  const loc = useLocation();
  const editing = loc.state?.entry || null;

  const [name, setName] = useState(editing?.name || "");
  const [mobile, setMobile] = useState(editing?.mobile || "");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [collector, setCollector] = useState(editing?.collector || "");
  const [newCollector, setNewCollector] = useState("");
  const [mode, setMode] = useState(editing?.payment_mode || "Cash");
  const [status, setStatus] = useState(editing?.status || "Collected");
  const [dateStr, setDateStr] = useState(editing?.date || todayISO());
  const [receiptBookId, setReceiptBookId] = useState(editing?.receipt_book_id || "");
  const [receiptNo, setReceiptNo] = useState(editing?.receipt_no ? String(editing.receipt_no) : "");
  const [collectors, setCollectors] = useState([]);
  const [books, setBooks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [useCustomCollector, setUseCustomCollector] = useState(false);
  const [bookEditor, setBookEditor] = useState(null); // { mode: "new"|"edit", form: {...} }

  const openNewBook = () => setBookEditor({ mode: "new", form: { name: "", prefix: "", start_no: 1, end_no: 50, assigned_to: "" } });
  const openEditBook = () => {
    const b = books.find((x) => x.id === receiptBookId);
    if (!b) return;
    setBookEditor({ mode: "edit", id: b.id, form: { name: b.name, prefix: b.prefix, start_no: b.start_no, end_no: b.end_no, assigned_to: b.assigned_to || "" } });
  };
  const saveBook = async () => {
    if (!bookEditor?.form?.name?.trim()) return toast.error("Name required");
    try {
      let saved;
      if (bookEditor.mode === "new") {
        saved = await receiptBookApi.create({
          name: bookEditor.form.name.trim(),
          prefix: bookEditor.form.prefix.trim() || null,
          start_no: Number(bookEditor.form.start_no),
          end_no: Number(bookEditor.form.end_no),
          assigned_to: bookEditor.form.assigned_to || null,
        });
      } else {
        saved = await receiptBookApi.update(bookEditor.id, {
          name: bookEditor.form.name.trim(),
          prefix: bookEditor.form.prefix.trim() || null,
          start_no: Number(bookEditor.form.start_no),
          end_no: Number(bookEditor.form.end_no),
          assigned_to: bookEditor.form.assigned_to || null,
        });
      }
      const list = await receiptBookApi.list();
      setBooks(list);
      setReceiptBookId(saved.id);
      setBookEditor(null);
      toast.success(bookEditor.mode === "new" ? "Book created" : "Book updated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  useEffect(() => {
    collectorApi.list().then(setCollectors).catch(() => {});
    receiptBookApi.list().then(setBooks).catch(() => {});
  }, []);

  // Auto-select last-used receipt book when adding a new entry
  useEffect(() => {
    if (editing || receiptBookId || books.length === 0) return;
    chandaApi.list().then((entries) => {
      const active = (entries || []).filter((c) => !c.voided && c.receipt_book_id);
      if (active.length === 0) return;
      // list() returns entries sorted date desc, created_at desc — pick the first with a book that still exists
      const last = active.find((c) => books.some((b) => b.id === c.receipt_book_id));
      if (last) setReceiptBookId(last.receipt_book_id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);

  const userEditedNoRef = useRef(false);

  useEffect(() => {
    if (!receiptBookId || editing) return;
    receiptBookApi.next(receiptBookId).then((r) => {
      // Always auto-fill next receipt number when book changes, unless the user has manually typed one
      if (r.next != null && !userEditedNoRef.current) setReceiptNo(String(r.next));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptBookId]);

  const submit = async (e) => {
    e?.preventDefault();
    const finalCollector = useCustomCollector ? newCollector.trim() : collector;
    if (!name.trim()) return toast.error("नाम भरें (Name required)");
    if (!amount || Number(amount) <= 0) return toast.error("Amount भरें");
    if (!finalCollector) return toast.error("Collector चुनें");

    setSaving(true);
    try {
      if (useCustomCollector && newCollector.trim()) {
        try { await collectorApi.create(newCollector.trim()); } catch (_e) { /* ignore duplicate */ }
      }
      const payload = {
        name: name.trim(),
        mobile: mobile.trim() || null,
        amount: Number(amount),
        collector: finalCollector,
        payment_mode: mode,
        status,
        date: dateStr,
        receipt_book_id: receiptBookId || null,
        receipt_no: receiptNo ? Number(receiptNo) : null,
      };
      if (editing) {
        await chandaApi.update(editing.id, payload);
        toast.success("Entry updated");
      } else {
        await chandaApi.create(payload);
        toast.success(`${formatINR(payload.amount)} added from ${payload.name}`);
      }
      nav("/list");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="add-chanda-page">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="add-back-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Outfit"}}>
          {editing ? "Edit Chanda" : "Add Chanda (चंदा जोड़ें)"}
        </h1>
      </div>

      <form onSubmit={submit} className="card-elevated p-5 space-y-5">
        {/* Name */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <User size={15} /> Donor Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="जैसे Ramesh Kumar"
            data-testid="add-name-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
          />
        </div>

        {/* Mobile */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Phone size={15} /> Mobile (optional)
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="98XXX XXXXX"
            data-testid="add-mobile-input"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
          />
        </div>

        {/* Receipt Book + No */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <BookOpen size={15} /> Receipt Book / No.
          </label>
          <div className="flex gap-2">
            <select
              value={receiptBookId}
              onChange={(e) => setReceiptBookId(e.target.value)}
              data-testid="add-receipt-book-select"
              className="flex-1 h-12 px-3 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white min-w-0"
            >
              <option value="">-- No book --</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.prefix}: {b.start_no}-{b.end_no})</option>
              ))}
            </select>
            <button type="button" onClick={openNewBook} data-testid="add-book-new-btn"
              className="w-11 h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shrink-0"
              aria-label="New book">
              <Plus size={18} />
            </button>
            {receiptBookId && (
              <button type="button" onClick={openEditBook} data-testid="add-book-edit-btn"
                className="w-11 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"
                aria-label="Edit book">
                <Pencil size={16} />
              </button>
            )}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={receiptNo}
            onChange={(e) => { userEditedNoRef.current = true; setReceiptNo(e.target.value); }}
            placeholder="Receipt No."
            disabled={!receiptBookId}
            data-testid="add-receipt-no-input"
            className="w-full h-12 px-3 mt-2 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base font-num font-bold disabled:bg-slate-50 disabled:text-slate-400"
          />

          {bookEditor && (
            <div className="mt-2 bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2" data-testid="add-book-editor">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                  {bookEditor.mode === "new" ? "New Receipt Book" : "Edit Receipt Book"}
                </div>
                <button type="button" onClick={() => setBookEditor(null)} className="w-6 h-6 rounded hover:bg-white flex items-center justify-center" data-testid="add-book-close">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={bookEditor.form.name} onChange={(e) => setBookEditor({ ...bookEditor, form: { ...bookEditor.form, name: e.target.value } })}
                  placeholder="Book Name (Book 3)" data-testid="add-book-name-input"
                  className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white" />
                <input type="text" value={bookEditor.form.prefix} onChange={(e) => setBookEditor({ ...bookEditor, form: { ...bookEditor.form, prefix: e.target.value } })}
                  placeholder="Prefix (B3)" data-testid="add-book-prefix-input"
                  className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={bookEditor.form.start_no} onChange={(e) => setBookEditor({ ...bookEditor, form: { ...bookEditor.form, start_no: e.target.value } })}
                  placeholder="Start" data-testid="add-book-start-input"
                  className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white font-num" />
                <input type="number" value={bookEditor.form.end_no} onChange={(e) => setBookEditor({ ...bookEditor, form: { ...bookEditor.form, end_no: e.target.value } })}
                  placeholder="End" data-testid="add-book-end-input"
                  className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white font-num" />
                <select value={bookEditor.form.assigned_to} onChange={(e) => setBookEditor({ ...bookEditor, form: { ...bookEditor.form, assigned_to: e.target.value } })}
                  data-testid="add-book-assigned-select"
                  className="h-10 px-2 rounded-lg border border-slate-300 outline-none text-sm bg-white">
                  <option value="">Assign...</option>
                  {collectors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <button type="button" onClick={saveBook} data-testid="add-book-save"
                className="w-full h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-1">
                <Check size={14} /> {bookEditor.mode === "new" ? "Create Book" : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <IndianRupee size={15} /> Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              data-testid="add-amount-input"
              className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-lg font-num font-bold"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setAmount(String(p))}
                data-testid={`preset-${p}`}
                className={`chip ${Number(amount) === p ? "chip-active" : ""}`}
              >
                ₹{p.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        {/* Collector */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Collector (Kisko Diya)</label>
          {!useCustomCollector ? (
            <>
              <select
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                data-testid="add-collector-select"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base bg-white"
              >
                <option value="">-- Select Collector --</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setUseCustomCollector(true); setCollector(""); }}
                data-testid="add-new-collector-toggle"
                className="mt-2 text-sm font-medium text-teal-700 hover:underline"
              >
                + Add new collector
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={newCollector}
                onChange={(e) => setNewCollector(e.target.value)}
                placeholder="Collector का नाम टाइप करें"
                data-testid="add-new-collector-input"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
              />
              <button
                type="button"
                onClick={() => { setUseCustomCollector(false); setNewCollector(""); }}
                data-testid="add-cancel-new-collector"
                className="mt-2 text-sm font-medium text-slate-600 hover:underline"
              >
                ← Choose from list
              </button>
            </>
          )}
        </div>

        {/* Payment Mode */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Payment Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                data-testid={`add-mode-${m.replace(/\s/g,'-').toLowerCase()}`}
                className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                  mode === m ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {["Collected", "Pending"].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                data-testid={`add-status-${s.toLowerCase()}`}
                className={`h-11 rounded-xl border font-semibold transition-colors text-sm ${
                  status === s
                    ? s === "Collected"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <CalIcon size={15} /> Date
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              data-testid="add-date-input"
              className="flex-1 h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 outline-none text-base"
            />
            <button
              type="button"
              onClick={() => setDateStr(todayISO())}
              data-testid="add-today-btn"
              className="px-4 h-12 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          data-testid="add-chanda-submit-btn"
          className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={18} /> {editing ? "Update Entry" : "Save Chanda"}
        </button>
      </form>
    </div>
  );
}
