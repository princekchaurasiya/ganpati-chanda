import React, { useEffect, useState, useRef } from "react";
import { collectorApi, backupApi, receiptBookApi } from "@/lib/api";
import { Plus, Trash2, Pencil, Check, X, Download, Upload, Info, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";

export default function Settings() {
  const [collectors, setCollectors] = useState([]);
  const [newName, setNewName] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [books, setBooks] = useState([]);
  const [bookForm, setBookForm] = useState({ name: "", prefix: "", start_no: 1, end_no: 50, assigned_to: "" });
  const [showBookForm, setShowBookForm] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    collectorApi.list().then(setCollectors);
    receiptBookApi.list().then(setBooks);
  };
  useEffect(() => { load(); }, []);

  const addBook = async (e) => {
    e?.preventDefault();
    if (!bookForm.name.trim()) return toast.error("Book name required");
    try {
      await receiptBookApi.create({
        name: bookForm.name.trim(),
        prefix: bookForm.prefix.trim() || null,
        start_no: Number(bookForm.start_no),
        end_no: Number(bookForm.end_no),
        assigned_to: bookForm.assigned_to || null,
      });
      setBookForm({ name: "", prefix: "", start_no: 1, end_no: 50, assigned_to: "" });
      setShowBookForm(false);
      toast.success("Receipt book created");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const removeBook = async (b) => {
    if (!window.confirm(`Remove ${b.name}?`)) return;
    try { await receiptBookApi.remove(b.id); toast.success("Removed"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Cannot remove"); }
  };

  const addCollector = async (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    try {
      await collectorApi.create(newName.trim());
      setNewName("");
      toast.success("Collector added");
      load();
    } catch {
      toast.error("Failed to add");
    }
  };

  const startEdit = (c) => { setEditingId(c.id); setEditName(c.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };
  const saveEdit = async (c) => {
    const name = editName.trim();
    if (!name) return toast.error("Name required");
    if (name === c.name) return cancelEdit();
    try {
      await collectorApi.update(c.id, name);
      toast.success(`Renamed to ${name}`);
      cancelEdit();
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Rename failed";
      toast.error(msg);
    }
  };

  const removeCollector = async () => {
    if (!confirmDel) return;
    try {
      await collectorApi.remove(confirmDel.id);
      toast.success(`${confirmDel.name} removed`);
      setConfirmDel(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const downloadBackup = async () => {
    try {
      const data = await backupApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, `chanda-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Backup downloaded — save to Google Drive / Email");
    } catch {
      toast.error("Backup failed");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const mode = window.confirm(
        "OK = REPLACE all existing data with backup.\nCancel = MERGE backup with existing data."
      ) ? "replace" : "merge";
      const res = await backupApi.restore({
        chandas: parsed.chandas || [],
        collectors: parsed.collectors || [],
        mode,
      });
      toast.success(`Restored ${res.chandas_restored} entries`);
      load();
    } catch {
      toast.error("Invalid backup file");
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4" data-testid="settings-page">
      <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>Settings (सेटिंग्स)</h1>

      {/* Receipt Books */}
      <section className="card-elevated p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><BookOpen size={16} /> Receipt Books</h2>
          <button onClick={() => setShowBookForm((v) => !v)} data-testid="toggle-book-form-btn"
            className="h-9 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-1">
            <Plus size={14} /> {showBookForm ? "Close" : "New Book"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Book + Receipt No. uniquely identifies each Chanda entry.</p>
        {showBookForm && (
          <form onSubmit={addBook} className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2" data-testid="book-form">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={bookForm.name} onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })}
                placeholder="Book Name (e.g. Book 3)" data-testid="book-name-input"
                className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white" />
              <input type="text" value={bookForm.prefix} onChange={(e) => setBookForm({ ...bookForm, prefix: e.target.value })}
                placeholder="Prefix (B3)" data-testid="book-prefix-input"
                className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={bookForm.start_no} onChange={(e) => setBookForm({ ...bookForm, start_no: e.target.value })}
                placeholder="Start" data-testid="book-start-input"
                className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white font-num" />
              <input type="number" value={bookForm.end_no} onChange={(e) => setBookForm({ ...bookForm, end_no: e.target.value })}
                placeholder="End" data-testid="book-end-input"
                className="h-10 px-3 rounded-lg border border-slate-300 outline-none text-sm bg-white font-num" />
              <select value={bookForm.assigned_to} onChange={(e) => setBookForm({ ...bookForm, assigned_to: e.target.value })}
                data-testid="book-assigned-select"
                className="h-10 px-2 rounded-lg border border-slate-300 outline-none text-sm bg-white">
                <option value="">Assign to...</option>
                {collectors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <button type="submit" data-testid="book-submit-btn"
              className="w-full h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm">Create Book</button>
          </form>
        )}
        {books.length === 0 ? (
          <div className="text-sm text-slate-500">No receipt books yet</div>
        ) : (
          <div className="space-y-1.5">
            {books.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl" data-testid={`book-row-${b.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">{b.name} <span className="text-[10px] text-slate-500 font-mono">({b.prefix})</span></div>
                  <div className="text-xs text-slate-500">
                    Receipt {b.start_no}–{b.end_no}{b.assigned_to ? ` · ${b.assigned_to}` : ""}
                  </div>
                </div>
                <button onClick={() => removeBook(b)} data-testid={`remove-book-${b.id}`}
                  className="w-9 h-9 rounded-lg text-red-600 hover:bg-white flex items-center justify-center">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Collectors */}
      <section className="card-elevated p-5">
        <h2 className="font-semibold text-slate-900 mb-1">Manage Collectors (Kisko Diya)</h2>
        <p className="text-xs text-slate-500 mb-3">Rename cascades to all past entries automatically.</p>
        <form onSubmit={addCollector} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collector का नाम"
            data-testid="new-collector-input"
            className="flex-1 h-12 px-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base"
          />
          <button type="submit" data-testid="add-collector-btn"
            className="h-12 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1">
            <Plus size={16} /> Add
          </button>
        </form>
        {collectors.length === 0 ? (
          <div className="text-sm text-slate-500">No collectors yet</div>
        ) : (
          <div className="space-y-1.5">
            {collectors.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors ${
                    isEditing ? "bg-teal-50 border border-teal-200" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                  data-testid={`collector-row-${c.id}`}
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        data-testid={`edit-collector-input-${c.id}`}
                        className="flex-1 h-10 px-3 rounded-lg border border-teal-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-base bg-white"
                      />
                      <button
                        onClick={() => saveEdit(c)}
                        data-testid={`save-collector-${c.id}`}
                        className="w-10 h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center"
                        aria-label="Save"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        data-testid={`cancel-edit-collector-${c.id}`}
                        className="w-10 h-10 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center"
                        aria-label="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 font-medium text-slate-800 truncate">{c.name}</div>
                      <button
                        onClick={() => startEdit(c)}
                        data-testid={`edit-collector-${c.id}`}
                        className="w-9 h-9 rounded-lg text-slate-600 hover:bg-white hover:text-teal-700 flex items-center justify-center transition-colors"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDel(c)}
                        data-testid={`remove-collector-${c.id}`}
                        className="w-9 h-9 rounded-lg text-red-600 hover:bg-white flex items-center justify-center transition-colors"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Backup */}
      <section className="card-elevated p-5">
        <h2 className="font-semibold text-slate-900 mb-1">Backup & Restore</h2>
        <p className="text-xs text-slate-500 mb-3 flex items-start gap-1">
          <Info size={12} className="mt-0.5 shrink-0" />
          Download JSON backup to Google Drive, Email, or cloud storage. Restore anytime.
        </p>
        <div className="space-y-2">
          <button onClick={downloadBackup} data-testid="backup-download-btn"
            className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2">
            <Download size={18} /> Download Backup (JSON)
          </button>
          <label className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-600 hover:bg-teal-50 cursor-pointer flex items-center justify-center gap-2 font-semibold text-slate-700 transition-colors">
            <Upload size={18} /> {restoring ? "Restoring…" : "Restore from Backup"}
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" data-testid="restore-input" />
          </label>
        </div>
      </section>

      <section className="card-elevated p-5 bg-teal-50 border-teal-200">
        <div className="flex gap-2">
          <Info size={16} className="text-teal-700 mt-0.5 shrink-0" />
          <div className="text-sm text-teal-900">
            <div className="font-semibold">Chanda Register v1.0</div>
            <div className="text-xs mt-1 text-teal-800">
              A simple, private Chanda/Donation collection register. Future: Expenses module coming soon.
            </div>
          </div>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="delete-collector-modal">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Collector?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Remove <span className="font-semibold">{confirmDel.name}</span> from the list?
              Past chanda entries will keep this name but it will no longer appear in the dropdown.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                data-testid="delete-collector-cancel"
                className="flex-1 h-11 rounded-xl border border-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={removeCollector}
                data-testid="delete-collector-confirm"
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
