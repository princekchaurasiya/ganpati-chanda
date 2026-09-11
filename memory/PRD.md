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
- ✅ **Expenses Module (2026-02, iteration 3)**: full CRUD (`/api/expenses`), category chips (Materials/Food/Decoration/Rent/Utilities/Transport/Other), optional paid-by, payment-mode, date, void/unvoid; dedicated /expenses list + /expenses/add form; dashboard now returns `total_expenses`, `count_expenses`, `by_expense_category`, `balance`. Backup/restore v2 includes expenses. Seed adds 3 demo expenses.
- ✅ **Add sheet**: FAB and header + button open a bottom-sheet that lets users pick Chanda or Expense in one tap.
- ✅ Reports: filters + column-picker checkboxes + PDF/Excel/CSV export with summary header; PDF uses "Rs." prefix (jsPDF ₹ glyph fix); WhatsApp share button uses Web Share API with wa.me fallback.
- ✅ Settings: manage collectors (inline edit + delete + rename cascade), JSON backup download, JSON restore (merge/replace mode)
- ✅ Bottom-nav mobile navigation (Dashboard, Chanda, खर्चे, Reports, Settings) + floating +Add FAB, mobile-first responsive layout
- ✅ Idempotent seed endpoint with 8 demo chanda entries + 4 default collectors + 3 demo expenses
- ✅ PWA-installable (manifest.json + theme color)

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
