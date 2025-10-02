# Diary AI — Health Analytics (Backend + Frontend)

Because spreadsheets deserve a vacation and your health data wants a proper home.

This project ingests your Garmin export into PostgreSQL, exposes a FastAPI backend for analytics and insights, and ships a React dashboard to visualize everything—like Jarvis for your training load (minus the British accent).

Highlights:
- Postgres-backed storage with migration utilities for Garmin data
- FastAPI backend with endpoints for sleeps, activities, trends, insights, predictions, and weight
- React frontend dashboard (Create React App) with charts and analysis
- Docker Compose for a one-command launch experience

Table of contents:
- Quick start
- Project layout
- Configuration
- GarminDb setup helper (optional)
- Running migrations
- Full reset (fresh DB + rebuild + migrate)
- API overview
- Frontend
- Troubleshooting
- FAQ

## Quick start
Pick your adventure: Docker (recommended) or local dev.

Option A — All-in with Docker:
1) Prereqs: Docker Desktop installed and running
2) Put your Garmin export into the HealthData directory at repository root (same level as `AI/`).
3) From the `AI/` directory, start services:
   ./start_all.sh
This builds and starts:
- Postgres on localhost:5432
- Backend API on http://localhost:5002
The script waits until the backend is healthy. To also spin up the frontend dev server:
   ./start_all.sh --with-frontend
Frontend will run on the first free port between 3000–3010 and proxy to the backend.

Option B — Manual Docker Compose:
   docker compose up -d --build
Stop everything with:
   ./stop_all.sh

## Project layout
- AI/docker-compose.yml — Postgres + Backend
- AI/start_all.sh, AI/stop_all.sh — convenience scripts
- AI/full_reset.sh — full rebuild: wipes DB volume, rebuilds, migrates, optionally starts frontend
- AI/.env.docker.example — optional overrides for compose
- AI/Diary-AI-BE — Backend (FastAPI + analytics + migrations)
- AI/Diary-AI-FE/frontend-react — Frontend (React + charts)
- HealthData/ — Your Garmin export (mounted read-only into the backend)

## Configuration
Backend environment (inside container) is loaded from `config.env` (copied from example) and env vars.
- Example local config: AI/Diary-AI-BE/config.env.example
- Example Docker overrides: AI/.env.docker.example

Recommended: Copy the example to `AI/Diary-AI-BE/config.env` and adjust if needed:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=diary
DB_USER=diary_user
DB_PASSWORD=diary123
HEALTH_DATA_PATH=HealthData
When running via Docker Compose, DB_HOST is automatically set to the service name `db`.

Health data mount:
- docker-compose mounts ../HealthData (from repo root) to /app/HealthData (read-only) inside the backend
- Make sure your Garmin export sits in `HealthData/` at the repo root

## GarminDb setup helper (optional)
Want to quickly configure GarminDb and fetch your export? Use the interactive helper:

- Location: `AI/scripts/setup_garmindb.py`
- What it does:
  - Installs/updates the `garmindb` package
  - Creates `~/.GarminDb/GarminConnectConfig.json` with your credentials and start dates
  - Optionally stores the password in a separate file with secure permissions
  - Can immediately run: `--all --download --import --analyze` (and optionally `--latest`)
- Usage examples:
  - Interactive (recommended):
       python AI/scripts/setup_garmindb.py
  - Non-interactive quick setup:
       python AI/scripts/setup_garmindb.py --username you@example.com --start-date 11/01/2024 --latest
  - Force upgrade of garmindb first:
       python AI/scripts/setup_garmindb.py --upgrade
- Note: The default base directory for downloads is `HealthData` under your home-relative path (as per the script config). Ensure your repository’s `HealthData/` contains the export you want to migrate.

## Running migrations (importing your Garmin data)
You can migrate all data or targeted subsets. After starting Docker services:
- Full migration:
   docker compose exec backend python run_migration.py --subset all
- Only sleep data:
   docker compose exec backend python run_migration.py --subset sleep
- Available subsets: all, daily, sleep, rhr, stress, hr, rr, activities, weight, journal, stats
If dependencies are missing (in local dev), run the setup helper:
   python AI/Diary-AI-BE/setup_migration.py
Then run:
   python AI/Diary-AI-BE/run_migration.py --subset all

Note: No Infinity Stones required—just patience while large exports crunch.

## Full reset (fresh DB + rebuild + migrate)
If you want to completely wipe the database volume, rebuild images, start the stack, and run the full migration in one go, use:
   ./full_reset.sh
Options:
- --with-frontend    Also start the local React dev server after migration
- --no-cache         Rebuild Docker images without using cache
- --skip-garmindb    Skip the pre-reset garmindb download/import step
- --help             Show usage and exit
What it does under the hood:
1) docker compose down -v (wipes the DB volume — your Postgres data is reset)
2) Rebuilds images (optionally without cache)
3) Starts Postgres and waits for health
4) Starts the backend and waits for /api/stats to respond
5) Runs the full migration inside the backend container
6) Optionally launches the frontend dev server
Caution: This resets your Postgres data (volume removal). If you need the old data, back it up first.

## API overview
Base URL: http://localhost:5002/api
Interactive docs: http://localhost:5002/api/docs
Selected endpoints:
- Health & stats
  - GET /api/health — quick health check
  - GET /api/stats — overall data stats
- Sleeps
  - GET /api/sleeps/latest?limit=20 — latest sleep sessions (+ optional date filters)
  - GET /api/sleeps/{sleep_id} — details for a single sleep session
- Activities
  - GET /api/activities/latest?limit=20 — newest activities
  - GET /api/activities/{activity_id} — activity details
- Trends & insights
  - GET /api/trends/health?days=90 — trend directions and sparklines
  - GET /api/insights/personalized?days=60 — personalized highlights
  - GET /api/insights/optimization?metric=sleep_quality&days=60 — factors tied to a metric
- Predictions
  - GET /api/predictions/energy?days_ahead=7
  - GET /api/predictions/sleep?days_ahead=7
  - GET /api/predictions/mood?days_ahead=7
  - GET /api/predictions/comprehensive?days_ahead=7
- Weight
  - GET /api/weight/current — latest weight/bmi
  - GET /api/weight/history?days=90 — recent weight entries
  - GET /api/weight/stats — averages, deltas, trend slope
  - GET /api/weight/correlations?days=90&min_abs=0.2 — correlations with key metrics
- Admin
  - POST /api/admin/models/retrain — delete cached models so they retrain on demand

Tip: The frontend dev server proxies to http://localhost:5002, so relative calls like `/api/stats` just work.

## Frontend (React)
Location: AI/Diary-AI-FE/frontend-react

Dev server:
1) Node.js ≥ 18
2) From `AI/Diary-AI-FE/frontend-react`:
   npm install
   npm start
It will open the dashboard at http://localhost:3000 (or the next free port) and proxy API calls to the backend.

Environment for development:
- .env.development.local sets REACT_APP_API_URL=http://localhost:5002

## Troubleshooting
- Backend isn’t coming up?
  - Check logs: docker compose logs backend
  - Make sure ports 5002 and 5432 are free
  - Try ./stop_all.sh to clean up stubborn processes
- No data showing?
  - Ensure HealthData/ exists at repo root and contains your Garmin export
  - Run migrations (see above) or run the full reset script
- CORS issues in custom setups?
  - Backend uses permissive CORS during migration; tighten in production as needed
- Where are the docs?
  - /api/docs for OpenAPI; see `AI/docs/` for architecture and quick API reference

## FAQ
- Can I run without Docker?
  - Yes. Use Python 3.13, install backend requirements, configure `config.env`, run `uvicorn scripts.backend_api_enhanced:app --port 5002` from `AI/Diary-AI-BE/scripts`, and run migrations.
- Where does my data live?
  - In PostgreSQL (docker volume `pg_data`). Your raw export is mounted read-only at `/app/HealthData`.
- Is this production-ready?
  - It’s battle-tested for personal analytics. Harden credentials, add HTTPS, and tune CORS before deploying to the wider galaxy.

May your VO2 max rise, your sleep scores shine, and your dashboards be ever green. 🖖
