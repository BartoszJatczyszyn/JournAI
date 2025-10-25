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
- Shell scripts (CLI helpers)
- Project layout
- Configuration
- GarminDb setup helper (optional)
- Running migrations
- Full reset (fresh DB + rebuild + migrate)
- API overview
- Frontend
- Utilities
- Troubleshooting
- FAQ

## Shell scripts (CLI helpers)

Your command-line sidekicks — think droids in Star Wars: helpful, loyal, and occasionally verbose. These live in the `AI/` folder unless noted.

### start_all.sh — “Make it so.”
- What it does: Builds and starts Docker services (Postgres + Backend, optionally LLM), waits for the backend to be healthy, and can launch the React dev server on the first free port 3000–3010.
- Usage:
  ```bash
  ./start_all.sh [--with-frontend] [--llm] [--workers N] [--first-boot-setup] [--yes] [--help]
  ```
- Notable flags:
  - `--with-frontend` — also starts the React dev server locally
  - `--llm` — starts the optional LLM service
  - `--workers|-w N` — sets `UVICORN_WORKERS` for the backend container
  - `--first-boot-setup` — force the GarminDb setup prompt even if already done
  - `--yes|-y` — auto-accept the GarminDb setup prompt
- Under the hood: chooses `docker compose` (or `docker-compose`), optionally runs `./setup_garmindb.sh` on first boot, starts `db` and `backend`, waits for `http://localhost:5002/api/health`, then optionally launches the frontend.

Pop-culture vibe: Like Tony Stark hitting the big “Run everything” button in the lab.

### stop_all.sh — “Order 66.”
- What it does: Stops Docker services and cleans up local React/Python processes; checks common ports and reports their status.
- Usage:
  ```bash
  ./stop_all.sh
  ```
- Details: Runs `docker compose down` (when available), then gracefully stops processes matching `react-scripts`, `app.cli.start_backend`, and friends.

### full_reset.sh — “The Thanos Snap (with backups recommended).”
- What it does: End-to-end reset. Optionally refreshes Garmin data via a one-off Python container, tears down the stack (with or without dropping the DB volume), rebuilds images, starts Postgres + backend, runs the full migration inside the backend container, and can start the frontend.
- Usage:
  ```bash
  ./full_reset.sh [--with-frontend] [--llm] [--no-cache] [--skip-garmindb] [--garmindb-latest] [--preserve-db|--no-drop-db] [--workers N] [--help]
  ```
- Defaults: Drops the DB volume unless `--preserve-db` or `--no-drop-db` is provided.
- Migration: Executes `python run_migration.py --subset all` inside the backend container.
- Garmin step: When not skipped, runs `garmindb_cli.py` in a temporary Python 3.13 container with host mounts for config/cache/data.
- Danger: Without `--preserve-db`, your Postgres volume is removed. Backup first if you care about the current data.

Perfect for fresh starts or big refactors. Use responsibly, like crossing the streams in Ghostbusters.

### setup_venv.sh — “Assemble the Avengers (Python edition).”
- What it does: Creates/refreshes a local virtualenv at `AI/.venv` using Python 3.13 (via pyenv if available), then installs `AI/requirements.txt`.
- Usage:
  ```bash
  ./setup_venv.sh
  ```
- Notes: Prefers pyenv-managed 3.13.x; falls back to `python3.13` if present. Handy for running local CLIs without Docker.

### setup_garmindb.sh — “Call the courier.”
- What it does: Ensures the venv exists and runs `Diary-AI-BE/app/cli/setup_garmindb.py`, installing `garmindb` and its parsing deps if needed.
- Usage:
  ```bash
  ./setup_garmindb.sh [flags forwarded to the Python CLI]
  ```
- Typical forward flags: `--username`, `--password`, `--start-date`, `--full`, `--latest`, `--upgrade`. See the “GarminDb setup helper” section below for details.

### cleanup_repo.sh — “Spring cleaning montage.”
- What it does: Removes `__pycache__`, frontend `build/`, stray logs, `.DS_Store`, and a legacy wrapper.
- Usage:
  ```bash
  ./cleanup_repo.sh            # interactive confirm
  ./cleanup_repo.sh --yes      # no prompt
  ```

### Diary-AI-BE/app/setup_python_env.sh — “For advanced pyenv wranglers.”
- Location: `AI/Diary-AI-BE/app/setup_python_env.sh`
- What it does: Manages Python via pyenv for the project, optionally uninstalling all pyenv versions (with confirmation), installing a target version, creating `AI/.venv`, and installing requirements.
- Usage:
  ```bash
  bash AI/Diary-AI-BE/app/setup_python_env.sh [--force] [--python X.Y.Z]
  ```
- Heads-up: This script interacts with pyenv installations; read its prompts and output carefully.

## Quick start



Pick your adventure: Docker (recommended) or local dev.

Option A — All-in with Docker:
1) Prereqs: Docker Desktop installed and running
2) Put your Garmin export into the HealthData directory at repository root (same level as `AI/`).
3) From the `AI/` directory, start services:
   ./start_all.sh            # starts db + backend only
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
Want to quickly configure GarminDb and fetch your export? Use the interactive helper script.

- Location: `AI/Diary-AI-BE/app/cli/setup_garmindb.py`
- Key points (short):
  - Requires Python >= 3.8.
  - Installs or upgrades `garmindb` (use `--upgrade`).
  - Writes config to `~/.GarminDb/GarminConnectConfig.json` (backups existing file).
  - Saves password to `~/.GarminDb/password.txt` (attempts to set chmod 600).
  - Defaults: `download_all_activities=3000`, `base_dir=HealthData` (relative_to_home = true).
  - Can run an import immediately (`--full` or confirm); the script runs `garmindb_cli.py` from the environment's scripts directory with `--all --download --import --analyze` (adds `--latest` when requested).

Selected options: `--username`, `--password`, `--start-date` (MM/DD/YYYY), `--individual-dates`, `--download-all-activities`, `--full`, `--latest`, `--upgrade`.

Examples:

  - Interactive:

  python AI/Diary-AI-BE/app/cli/setup_garmindb.py

  - Quick (no prompts):

  python AI/Diary-AI-BE/app/cli/setup_garmindb.py --username you@example.com --start-date 11/01/2024 --latest

Note: if the script cannot find `garmindb_cli.py` in the environment's scripts directory, the import step will not run — the configuration will still be saved.

## Running migrations (importing your Garmin data)
You can migrate all data or targeted subsets. After starting Docker services:
- Full migration (new path):
  docker compose exec backend python -m app.migrations.cli.run_migration --subset all
- Only sleep data (new path):
  docker compose exec backend python -m app.migrations.cli.run_migration --subset sleep
- Available subsets: all, daily, sleep, rhr, stress, hr, rr, activities, weight, journal, stats
Backwards-compatible legacy entrypoints still work:
  docker compose exec backend python run_migration.py --subset all
If dependencies are missing (in local dev), run the setup helper (new path):
  python -m app.migrations.cli.setup_migration
Legacy path (still works):
  python AI/Diary-AI-BE/setup_migration.py

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

## Local LLM — currently not recommended

This project previously supported running a local LLM server (llama.cpp with a GGUF Mistral model) for natural-language reports. That content has been moved here and is currently marked as "not recommended":

- The LLM server would run at `http://localhost:8080/v1` when enabled.
- Model path (inside the container): `/models/mistral-7b-openorca.Q4_K_M.gguf` (repository `AI/models`).
- Env vars used by the backend when LLM is enabled: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_HTTP_TIMEOUT`, and scheduler-related flags (e.g., `ENABLE_LLM_REPORT_SCHEDULER`, `LLM_REPORT_DAYS`, `LLM_REPORT_LANGUAGE`, `LLM_SCHEDULE_HOUR`, `LLM_SCHEDULE_MINUTE`).

Notes:
- Running a local LLM requires a suitable model in `AI/models` and significant local resources. For most users we do not recommend enabling this feature now.
- If you still want to try it, the old quick-start instructions were: download the GGUF model to `AI/models`, start the stack with `./start_all.sh --llm`, and test the endpoints `GET /api/llm/health` and `POST /api/llm/chat` against `http://localhost:8080/v1`.

## Utilities
- Daily journal filler CLI: `AI/Diary-AI-BE/app/cli/fill_daily_journal.py`
  - Example: `python AI/Diary-AI-BE/app/cli/fill_daily_journal.py --days 300 --commit`
  - Note: The old compatibility wrapper `AI/temp_dailyJournal` has been removed. Please use the CLI path above.

### Start backend locally via CLI (optional)
For a quick local run without Docker (with auto-reload, etc.):

  python -m app.cli.start_backend --reload --port 5002 --workers 1

This uses the same checks and startup flow as the Docker image. You can still run uvicorn directly if you prefer (see FAQ).

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

## Dev linting and hooks

Python linters/hooks are set up via Ruff + Flake8 and pre-commit.

Quick setup:

1) Install dev tools (in your active Python env):

  python -m pip install -r AI/Diary-AI-BE/app/dev_requirements.txt

2) Install git hooks:

  pre-commit install

3) (Optional) Run on entire repo once:

  pre-commit run --all-files

Configuration lives in `pyproject.toml` (Ruff/Black/Flake8) and `.pre-commit-config.yaml`.

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
  - Yes. Use Python 3.13, install backend requirements, configure `config.env`, and run either:
    - Preferred: `uvicorn app.backend_api_enhanced:app --port 5002`
  - Legacy (still works): `uvicorn scripts.backend_api_enhanced:app --port 5002` from `AI/Diary-AI-BE/app` (prior layout)
- Where does my data live?
  - In PostgreSQL (docker volume `pg_data`). Your raw export is mounted read-only at `/app/HealthData`.
- Is this production-ready?
  - It’s battle-tested for personal analytics. Harden credentials, add HTTPS, and tune CORS before deploying to the wider galaxy.

May your VO2 max rise, your sleep scores shine, and your dashboards be ever green. 🖖
