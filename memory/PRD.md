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

## Persona
Non-technical community/mandir/mohalla volunteer who collects donations for local events. Wants to add entries in seconds on mobile, see running totals, share PDF report with the committee.

## Backlog (Not built — future)
- P1: Expenses module → net balance (Total Chanda − Total Expenses)
- P1: Group/event tagging (e.g., "Ganesh Utsav 2026" vs "Diwali 2026")
- P2: Recurring donors quick-repeat
- P2: WhatsApp share of PDF / entry
- P2: Google Drive direct-sync backup
- P2: Offline-first with service worker + IndexedDB queue
- P2: Multi-user PIN lock
