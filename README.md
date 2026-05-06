# License & User Management Server (FastAPI + Admin Panel)

Production-ready license server with a clean Tailwind admin panel (desktop table + mobile cards), plus a `/validate` endpoint for client scripts.

## Features

- **Admin panel**: create/edit/block/delete licenses, responsive UI, icon-only actions, search (username/plan/key).
- **License validation API**: `GET/POST /validate` checks key, HWID, status, expiry, and device limit.
- **Storage**:
  - **MongoDB Atlas (recommended)** via `MONGODB_URI`
  - Fallback to **SQLite/PostgreSQL** via `DATABASE_URL`
- **6-digit license keys** (numeric), copyable from admin UI.

## Requirements

- Python **3.10+**

## Setup (local development)

```powershell
cd "c:\Users\Siam H\Desktop\siamx"
python -m pip install -r requirements.txt
```

Create `.env` (do **not** commit it). Example:

```ini
SECRET_KEY=change-me-to-a-long-random-string
ADMIN_PASSWORD=change-me-strong-password

# MongoDB (if set, MongoDB is used instead of SQLite/PostgreSQL)
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=license_server

# Optional SQL (used only if MONGODB_URI is NOT set)
# DATABASE_URL=sqlite:///./data/licenses.db
```

Run:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- Admin: `http://127.0.0.1:8000/admin`
- OpenAPI: `http://127.0.0.1:8000/docs`

## Client usage

Validate license:

- `GET /validate?license_key=123456&hwid=...`
- `POST /validate` JSON:

```json
{ "license_key": "123456", "hwid": "device-id" }
```

## Deploy notes

- **Use HTTPS** for real clients (browser scripts on HTTPS sites cannot call plain `http://` endpoints).
- Keep `SECRET_KEY`, `ADMIN_PASSWORD`, `MONGODB_URI` as environment variables in your host (Render/Railway/VPS).

## Deploy on Render (Python runtime)

This repo includes `render.yaml`. On Render:

- **Runtime**: Python
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root Directory**: leave blank (repo root)

Set environment variables in Render:

- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `MONGODB_URI`
- `MONGODB_DB` (default: `license_server`)

