# FreshGuard AI backend

A small Express and SQLite API for the FreshGuard AI conveyor inspection project. It receives CV inspections, stores business records, and provides data to the supervisor, quality, manager, and AI-agent clients.

## Requirements

- Node.js 20 or newer
- A SQLite database file with the tables and columns listed in the project contract

The backend creates the required tables in SQLite with the supplied schema. It does not run migrations or insert seed data. At startup it checks for the eight required table names and exits with a readable message if any are missing.

## Install and configure

In a terminal, change to this `backend` folder and run:

```powershell
npm install
Copy-Item .env.example .env
npm run init-db
```

Set values in `.env`:

```dotenv
PORT=3000
DB_PATH=./data/freshguard.db
DEFECT_RATE_THRESHOLD=0.2
BASE_URL=http://localhost:3000
```

`DB_PATH` is relative to the backend working directory unless an absolute path is given. `DEFECT_RATE_THRESHOLD` is a fraction: `0.2` means 20%. The `npm run init-db` command creates the database and applies `src/db/schema.sql`.

`line_id` is a positive integer (for example, `1`) in request bodies and query parameters.

Inspection ingest accepts these optional model fields:

- `size_category`: `small`, `medium`, or `large`.
- `needs_review`: boolean (`true`/`false`; multipart forms also accept `1`/`0`). Defaults to `false`.
- `model_version`: text up to 50 characters.

Run the full endpoint test suite with `npm run test:all`. It creates a fresh temporary database and removes it when the run finishes; it does not change `data/freshguard.db`.

## Run

```powershell
npm start
```

For development with automatic restarts:

```powershell
npm run dev
```

The server listens on `0.0.0.0`, prints the machine's local network IP, and serves Swagger at `http://localhost:3000/docs`. To connect a mobile device on the same network, use the printed address, for example `http://192.168.1.25:3000`. Make sure the computer firewall allows incoming connections on the configured port.

There is no authentication. Use this API only on a trusted local network.

## Test every endpoint with curl

Examples below assume PowerShell, where `curl.exe` avoids the old `curl` alias. Replace the base URL/IP as needed.

### Health

```powershell
curl.exe http://localhost:3000/health
```

### CV ingest

Send a JSON inspection (the line's open batch is used or created automatically):

```powershell
curl.exe -X POST http://localhost:3000/api/ingest/inspection -H "Content-Type: application/json" -d '{"product_type":"tomato","status":"defective","confidence":0.94,"defect_type":"rotten","line_id":1,"captured_at":"2026-10-30T08:00:00.000Z"}'
```

Send an inspection with an optional image. The API accepts JPG/JPEG or PNG up to 5 MB:

```powershell
curl.exe -X POST http://localhost:3000/api/ingest/inspection -F "product_type=apple" -F "status=good" -F "confidence=0.98" -F "line_id=1" -F "captured_at=2026-10-30T08:00:00.000Z" -F "image=@C:\temp\apple.jpg"
```

Send a batch as a JSON array:

```powershell
curl.exe -X POST http://localhost:3000/api/ingest/inspections/batch -H "Content-Type: application/json" -d '[{"product_type":"apple","status":"good","confidence":0.99,"line_id":1,"captured_at":"2026-10-30T08:00:00.000Z"},{"product_type":"potato","status":"defective","confidence":0.9,"defect_type":"bruised","line_id":1,"captured_at":"2026-10-30T08:00:01.000Z"}]'
```

### Supervisor

```powershell
curl.exe "http://localhost:3000/api/supervisor/inspections?limit=20&line_id=1"
curl.exe "http://localhost:3000/api/supervisor/current-batch?line_id=1"
curl.exe "http://localhost:3000/api/supervisor/alerts?unread=true"
```

### Quality

```powershell
curl.exe "http://localhost:3000/api/quality/defects?from=2026-10-30&to=2026-10-31&product_type=tomato"
curl.exe http://localhost:3000/api/quality/alerts
curl.exe "http://localhost:3000/api/quality/needs-review?limit=100&offset=0"
curl.exe -X PATCH http://localhost:3000/api/quality/alerts/1/read
curl.exe "http://localhost:3000/api/quality/stats/defects-by-type?from=2026-10-01&to=2026-10-31"
curl.exe http://localhost:3000/api/quality/inspections/1
```

### Company manager

```powershell
curl.exe "http://localhost:3000/api/manager/summary?from=2026-10-01&to=2026-10-31"
curl.exe "http://localhost:3000/api/manager/daily-report?date=2026-10-30"
curl.exe "http://localhost:3000/api/manager/trends?days=7"
curl.exe -X POST http://localhost:3000/api/manager/production -H "Content-Type: application/json" -d '{"batch_id":1,"quantity":100,"recorded_at":"2026-10-30T08:00:00.000Z"}'
curl.exe -X POST http://localhost:3000/api/manager/waste -H "Content-Type: application/json" -d '{"batch_id":1,"quantity":5,"reason":"defective","recorded_at":"2026-10-30T08:00:00.000Z"}'
curl.exe -X POST http://localhost:3000/api/manager/costs -H "Content-Type: application/json" -d '{"batch_id":1,"amount":25.5,"category":"packaging","recorded_at":"2026-10-30T08:00:00.000Z"}'
curl.exe -X POST http://localhost:3000/api/manager/revenue -H "Content-Type: application/json" -d '{"batch_id":1,"amount":250,"recorded_at":"2026-10-30T08:00:00.000Z"}'
```

`batch_id` may be omitted when entering a business record.

### Internal AI/BI API

```powershell
curl.exe http://localhost:3000/api/internal/overview
curl.exe "http://localhost:3000/api/internal/query/inspections?from=2026-10-30&product_type=tomato&line_id=1&limit=20"
curl.exe "http://localhost:3000/api/internal/query/stats?from=2026-10-30&to=2026-10-31&product_type=tomato&line_id=1"
curl.exe -X POST http://localhost:3000/api/internal/agent/log -H "Content-Type: application/json" -d '{"question":"What is the current defect rate?","answer":"The latest defect rate is 4 percent."}'
curl.exe "http://localhost:3000/api/internal/agent/logs?limit=20"
```

All API errors use JSON in this format: `{"error":"message"}`. Use `/docs` for the interactive API reference.

The needs-review endpoint returns flagged inspections newest first and supports `limit` and `offset` pagination. Each inspection's `needs_review` value is returned as a JSON boolean. Flagged inspections also create a `needs_review` alert containing the inspection ID and product type.

## Simulators

Start the backend first. In another terminal:

```powershell
npm run simulate:cv
```

The CV simulator sends a randomly generated inspection about every 1.5 seconds. Set `BASE_URL` in `.env` to send to another server.

Run the AI-agent API example once:

```powershell
npm run simulate:agent
```

It reads the overview, requests today's inspection stats, writes one sample agent log, and prints each response.
