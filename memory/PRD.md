# Chanda Register — PRD

## Original Problem Statement
Build a simple, lightweight PWA-ready web app for Chanda/Donation collection management. Track people from whom donations are expected/received with only these fields: Name, Amount, Collector (Kisko diya), Payment Mode (Cash/UPI/Bank Transfer/Other), Status (Pending/Collected), Date. Mobile-first, single-user, ₹ INR, big buttons, non-technical friendly.

## User Choices (Feb 2026)
- Single user, no login
- Collector: both dropdown + free-text add
- Backup: cloud-oriented (JSON download → save to Google Drive/Email)
- Currency: ₹ INR
- Theme: Clean light theme, mobile-first, big buttons

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`.
  - Chanda CRUD, void/unvoid, dashboard aggregation, collectors, backup/restore, idempotent seed.
- **Frontend**: React 19 + React Router + Tailwind + shadcn primitives, sonner toasts, lucide-react icons.
  - 5 routes: `/` Dashboard, `/add` AddChanda, `/list` ChandaList, `/reports` Reports, `/settings` Settings.
- **PWA**: manifest.json, standalone display, teal theme color.
- **Exports**: jsPDF + jspdf-autotable (PDF), xlsx (Excel/CSV) with column picker.

## Implemented (2026-02)
- ✅ Add Chanda form with quick-amount chips (₹101/₹251/₹501/₹1100/₹2100/₹5100), preset collectors + free-text new collector, native date picker with Today button
- ✅ Dashboard: KPI hero, Balance card (Chanda − Expenses), Pending & Expenses stat cards, payment-mode grid, collector-wise breakdown with progress bars, Recent 5 entries
- ✅ Chanda List: search, filter by status/mode/collector/date-range, show-voided toggle, quick status toggle, edit, void with confirm modal
- ✅ Expenses Module: full CRUD (`/api/expenses`), category chips, optional paid-by, payment-mode, date, void/unvoid; dashboard `total_expenses`, `count_expenses`, `by_expense_category`, `balance`
- ✅ Add sheet: FAB and header + button open a bottom-sheet with Chanda/Transfer/Reimburse/Expense choices
- ✅ Reports: filters + column-picker checkboxes + PDF/Excel/CSV export with summary header; PDF uses "Rs." prefix; WhatsApp share button
- ✅ Settings: manage collectors (inline edit + delete + rename cascade to chandas/expenses/transfers/reimbursements), JSON backup download, JSON restore
- ✅ Bottom-nav mobile navigation (Dashboard, Chanda, खर्चे, Members, Settings) + floating +Add FAB
- ✅ **Ledger + Settlement (2026-02, iteration 4)**: Members tab with per-member cards, Transfers (from_member → to_member) that never count as new Chanda, transaction Ledger view, Reimbursements that clear personal advances. Chanda now separates `amount` (promised) vs `received_amount` (actual received) — pending money is never counted as available cash.
- ✅ **Personal Contribution + Reimbursement (2026-02, iteration 5)**: Expense form splits payment into Group Funds + Personal Contribution; splits must sum to Amount Paid; validation prevents group_funds > member's held cash. Reimbursements pay back personal contribution from another member's group cash. Dashboard shows Member Advances / Reimbursements section (personal, reimbursed, outstanding). Never double-counts money.
- ✅ Acceptance scenario verified end-to-end (Monu ₹10k + Shrikant ₹2k → transfer ₹2k → expense ₹12k pays ₹65k bill → total Chanda stays ₹12k, cash held 0, bill balance ₹53k).
- ✅ PWA-installable (manifest.json + theme color)
- ✅ **Receipt Book + Number visible in Dashboard (2026-02, agentic edit)**: Recent Chanda list on Dashboard main body and Chanda rows inside every StatModal now show the receipt badge (e.g. `B0/051`) + full `Book 2 #51` label alongside collector · mode · date for instant traceability.
- ✅ **Payment Mode tiles + Member rows clickable (2026-02, agentic edit)**: Cash/UPI/Bank/Other tiles open `mode:<Mode>` modal with count + total + full receipt-tagged chanda rows. Member-wise Summary rows open `member:<Name>` modal with a summary grid (Collected / Cash Held / Paid to Expenses / Transfers / Personal Contrib / Reimb Due) and Collected + Pending sub-lists.
- ✅ **All-field edit access from Members (2026-02, agentic edit)**: MemberDetail rows (chandas, transfers in/out, expenses, reimbursements in/out) now each show a pencil that navigates to the corresponding add-in-edit-mode page (all fields editable). A teal hint banner on MemberDetail + a "Tap to edit entries" pill on every member card in /members surface the affordance. MemberDetail root has pb-24 so last-row pencils stay above the mobile FAB.
- ✅ **AddChanda auto-fill (2026-02, agentic edit)**: On new-entry load the receipt-book <select> defaults to the last-used book and the receipt-no input auto-fills with the next available number. `userEditedNoRef` gates the auto-fill so user-typed numbers are never overwritten when switching books.
- ✅ **Receipt Book "Unassigned" fix (2026-02, agentic edit)**: `PUT /api/receipt-books/{id}` now allows `assigned_to`/`note` to be cleared via null while still ignoring None on required scalars (name/prefix/start_no/end_no). ReceiptBook.prefix now Optional.
- ✅ **IST timestamps in Ledger + Transfers (2026-02, agentic edit)**: `GET /api/ledger` returns `created_at` and sorts most-recent-first. Ledger + Transfers rows render `9 Sept 2026 · 10:00 am IST` via `formatDateTimeIST` (Asia/Kolkata locale-safe).
- ✅ **Real data imported (2026-09)**: Dummy chanda/expense/transfer/reimbursement wiped. 38 real chandas imported (Total Promised ₹72,832 / Received ₹58,909 / Pending ₹13,923). New collectors added: `Ramakant amit brijesh`, `Mogli`. Receipt book/number left blank for user to fill via inline edit later.
- ✅ **Book + Receipt No in exports (2026-09-11)**: Reports page column picker me `Book` aur `Receipt No` columns add ho gaye (checked by default). PDF/Excel/CSV — teeno me appear hote hain, order: Book, Receipt No, Name, Amount, Collector, Payment Mode, Status, Date.
- ✅ **Authoritative refresh from user's Excel (2026-09-11)**: 78 chandas cleanly imported from `chanda-2026-09-11 (1).xlsx`. Book/Receipt filled where user provided; blanks preserved. Amount/name corrections applied (Shitlaprasad 1111, Satyam 1111, Chunnilal, Munn/Palak/Surabhi 0). 12 new Manoj entries assigned to Book 2 (81-92). Prem Jaiswal marked Collected. New collector: `Manoj`. Case-duplicate `Prince` merged into `prince`. Totals: Promised ₹1,14,763 · Received ₹65,963 · Pending ₹48,800.
- ✅ **Financial mutation batch (2026-09-11)**: Receipt #74 collector bug fixed (Ramakant amit brijesh → prince, so prince's real total is ₹7,207 base). New member **Atul** added. Expenses: Monu ₹12k murti + ₹15k mandap; Mogli ₹25k mandap-token + ₹5k murti + ₹5k mandal certificate = ₹35k total; Atul ₹4,275 frame/lokhand (funded via Monu transfer); Ramakant ₹500 police (funded via prince transfer). Transfers: prince→Ramakant ₹500, prince→Atul ₹2k banner, Shrikant→Monu ₹2k (empties Shrikant), Monu→Atul ₹4,275. 3 new no-receipt Collected chandas: Dhaniram Gupta ₹2,100 → prince, Mr Chaurasiya (Brijesh ka dost) ₹1,500 → prince, Mintu Bhai ₹7,551 UPI → Monu. Final totals: 81 chandas, Promised ₹1,25,914 · Received ₹77,114 · Expenses paid ₹66,775 · Monu held **-₹5,472** (reimbursement due) · Mogli held +₹5,002.
- ✅ **Event / Purpose tagging (2026-02-15)**: New `event` field on Chanda + Expense (default `Ganpati Mandap`). AddChanda/AddExpense pe Event chip selector + `+ New` button for on-the-fly events. ChandaList, Expenses, Reports pages me Event filter chips added. Dashboard pe naya "Event / Purpose Breakdown" card (per-event Received, Expenses, Net + drill-down modal with all chandas + expenses of that event). Reports PDF/Excel/CSV aur Expenses PDF/Excel exports me `Event` column added. Data migration: 6 Dahi Handi helper chandas (Raghav, Ramakant amit brijesh, pravin, Aashique Ali, Manoj, Mintu — ₹3,500 total) + ₹7,000 Dahi Handi expense marked as `Dahi Handi`; baaki 81 chandas + 9 expenses `Ganpati Mandap`. Verified totals: Ganpati Mandap Recv ₹77,114 / Exp ₹68,775 / Net **+₹8,339** · Dahi Handi Recv ₹3,500 / Exp ₹7,000 / Net **-₹3,500**.
- ✅ **Cross-Event Fund Transfer (2026-02-15)**: New `event_transfers` collection + CRUD (`POST/GET/PUT/DELETE /api/event-transfers`). Dashboard event row shows "Cover ₹X loss from another event" CTA when Net < 0. One-click modal (`CoverLossForm`) picks source event with positive surplus, defaults amount = shortfall, records transfer. Dashboard `by_event` includes `contributed_out` / `covered_in` fields; Net = received - expense_paid - contributed_out + covered_in. Member cash balances UNCHANGED — purely event-reporting accounting entry. Event drill-down modal shows Event Transfers list with delete option.
- ✅ **Donor Member linking (2026-02-15)**: New `donor_member` optional field on Chanda — links a donation to a team member's profile. AddChanda pe "Ye donor group member hai?" dropdown (all collectors). MemberDetail "Donations Given" section shows both exact-name and donor_member matches. Cleanup script `/app/backend/link_donors.py` auto-linked 14 chandas: Mintu ₹8,051 (₹500 + ₹7,551 "Mintu Bhai"), Mogli ₹5,000 ("Mogali" typo), pravin ₹5,600 (₹500 + ₹5,100 "Pravin bhai"), prince ₹5,001 ("Prince Chaurasiya" only; Siyaram unlinked per user), Monu ₹5,000, Manoj ₹1,001, dinesh chaurasiya ₹3,500, Aashique Ali ₹1,000, Raghav ₹500, Ramakant amit brijesh ₹500. Backend `PUT /api/chanda/{id}` now accepts empty string for `donor_member`/`note`/`mobile` (nullable text clear behavior).
- ✅ **MemberDetail cards clickable + drill-down modal (2026-02-15)**: Har MiniCard (Total Collected, Total Promised, Transferred Out, Received From Others, Group Funds Paid, Personal Contribution, Reimbursement Received, Current Group Held) + Currently Held hero card ab clickable hai. Modal opens with Book/Receipt No badge, name, event tag, amount, date, mode — plus inline edit pencil that navigates to Add/Edit page. Held card modal shows tally breakdown (received + trf_in − trf_out − group_paid − reimb_paid_out = held).

## Persona
Non-technical community/mandir/mohalla volunteer who collects donations for local events. Wants to add entries in seconds on mobile, see running totals, share PDF report with the committee.

## Backlog (Not built — future)
- P1: Expenses module → net balance (Total Chanda − Total Expenses)
- ~~P1: Group/event tagging (e.g., "Ganesh Utsav 2026" vs "Diwali 2026")~~ ✅ Done 2026-02-15
- P2: Sortable Member Table (Collected / Held / Reimb Due headers)
- P2: Receipt Book progress/warning ("X/Y used" badge)
- P2: Ganpati Mandap fund covers Mogli loss (trigger reimbursement if he goes negative)
- P2: Recurring donors quick-repeat
- P2: WhatsApp share of PDF / entry
- P2: Google Drive direct-sync backup
- P2: Offline-first with service worker + IndexedDB queue
- P2: Multi-user PIN lock
- P3: Year-wise historical reporting filter
