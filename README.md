B3 Calculator
==============

Investment simulator that uses historical B3 data. The project is split into two apps:

- backend (Node + Express + SQLite): ingests tickers, prices and dividends (via Yahoo Finance) and exposes the calculation API.
- frontend (React + Vite + Tailwind): UI to search tickers, configure contributions and view the summary and the operations history.

Requirements
------------

- Node 18+ (20+ recommended)
- npm (or pnpm/yarn)

Installation
------------

1) Install backend and frontend dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

Data ingestion
--------------

The backend needs a SQLite database with prices and dividends. There is a CSV with tickers at `backend/data/acoes-listadas-b3.csv`.

- Full ingestion (may take a while depending on the number of tickers):

```bash
cd backend
npm run ingest
```

- Ingestion with a limit (useful for quick tests):

```bash
cd backend
node scripts/ingest.js --limit 10
```

The database will be created at `backend/data/stocks.sqlite3`.

Run the servers
---------------

- API (default port 3000):

```bash
cd backend
npm start
```

- Frontend (Vite dev server, default port 5173):

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`. The frontend is configured to call the API on the same origin (`/api/...`). If you run the backend on a different origin, configure a Vite proxy or set an env like `VITE_API_BASE` and adjust the frontend calls accordingly.

Usage flow
----------

1. Run ingestion to create/update the database
2. Start the API
3. Open the frontend, search for a ticker, set initial/monthly contributions, choose the start date, and calculate

Project structure
-----------------

- `backend/scripts/ingest.js`: downloads data from Yahoo Finance and populates SQLite
- `backend/scripts/server.js`: REST API (`/api/stock_infos/search`, `/api/calculate_investment`)
- `frontend/src/pages/Simulate.tsx`: main simulation page

Notes
-----

- Ingestion is sequential by default to be gentle with the public API; adjust if needed.
- The calculation endpoint validates the start date to ensure it is not earlier than the first available price for the asset.
- The project uses `better-sqlite3` for performance and simplicity when accessing SQLite.


