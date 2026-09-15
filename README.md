# Ganpati Chanda

Mobile-first chanda (donation) register for mandal / mandir collections. Track promised vs received amounts, collectors, expenses, member cash, transfers, reimbursements, receipt books, and year-scoped reports.

This is a local setup of the [ganpati-chanda](https://github.com/princekchaurasiya/ganpati-chanda) app: FastAPI + MongoDB backend and a React (CRA + Tailwind + shadcn) PWA frontend.

## What you can do

- Add chanda with receipt book/number, collector, payment mode, event tag
- Dashboard with collected / pending / expenses / member cash held
- Members page: tap **Update** on a member to change collection, transfer, or paid amounts (not only the name)
- Each member **Hisab PDF**: uska plus/minus NET HISAB + collections, transfers, expenses
- Each member **Reports** menu: Chanda report (PDF/Excel) and Expense report (PDF/Excel)
- Members list **Hisab PDF**: sab members ka plus/minus net hisab bade font mein
- Filterable lists, PDF / Excel / CSV reports
- JSON backup and restore (Settings)
- Year switcher so 2026 data stays separate from a new year

No login. Single-user, rupee amounts, Hindi + English labels.

## Requirements

- Python 3.11+
- Node.js 18+ and Yarn 1
- MongoDB 7/8, **or** Docker (for `docker compose up mongo`)

## Local setup

Install Python + Node deps, start MongoDB, and import `data/chanda-backup-2026-09-15.json`:

```bash
chmod +x scripts/*.sh
./scripts/install.sh
```

Then run the app (UI + API on one port — avoids Preview empty-response / Axios network errors):

```bash
./scripts/start-app.sh
# open http://127.0.0.1:45211
```

Or step by step:

```bash
./scripts/setup.sh          # venv + yarn + .env files
./scripts/start-mongo.sh    # MongoDB (or: docker compose up -d mongo)
./scripts/import-backup.sh  # restore the 15 Sep 2026 backup (replace)
```

Re-import the bundled backup any time with `./scripts/import-backup.sh`. Demo seed (`POST /api/seed`) is only for an empty database and is skipped if chanda rows already exist.

## Environment

Copy the examples if you need to change ports or the database name.

`backend/.env`

```
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=ganpati_chanda
CORS_ORIGINS=*
```

`frontend/.env`

```
PORT=45211
HOST=0.0.0.0
BROWSER=none
REACT_APP_BACKEND_URL=
BACKEND_PROXY_TARGET=http://127.0.0.1:18080
```

Leave `REACT_APP_BACKEND_URL` empty so the browser talks to `/api` on the same origin. The CRA dev server proxies that to FastAPI.

## App routes

| Path | Screen |
| --- | --- |
| `/` | Dashboard |
| `/add` | Add / edit chanda |
| `/list` | Chanda list |
| `/expenses` | Expenses |
| `/members` | Members + ledger |
| `/reports` | Reports + export |
| `/settings` | Collectors, backup, restore |

API docs while the backend is running: [http://127.0.0.1:18080/docs](http://127.0.0.1:18080/docs)

## Project layout

```
backend/          FastAPI app (server.py) and pytest suites
frontend/         React PWA
docker-compose.yml   MongoDB only
scripts/          setup + Mongo helpers
memory/PRD.md     Product notes from the original build
```
