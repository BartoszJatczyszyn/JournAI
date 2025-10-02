<div align="center">

# JournAI

Self‑hosted personal health & Garmin analytics platform.

FastAPI backend • PostgreSQL storage • Advanced ML analytics • Optional React frontend.

</div>

---

## ✨ Key Features
- FastAPI backend (fully migrated off Flask) on port `5002`
- Structured long‑term storage in PostgreSQL 16
- Advanced analytics: correlations, clustering, temporal & recovery patterns
- Predictive models (energy, mood, sleep quality)
# JournAI

Self-hosted personal health & Garmin analytics platform.

This README starts with quick instructions for importing Garmin data using the included
`scripts/setup_garmindb.py` helper (recommended first step). After that you'll find how to
run the project with Docker Compose and what the helper scripts (`full_reset.sh`,
`start_all.sh`, `stop_all.sh`) do.

Table of contents
- Garmin data bootstrap (scripts/setup_garmindb.py)
- Run with Docker Compose
- Helper scripts: full_reset.sh, start_all.sh, stop_all.sh
- Quick developer notes
- Project layout

---

## Garmin data bootstrap (scripts/setup_garmindb.py)

This project can ingest Garmin exports using the `garmindb` format. The repository includes
`scripts/setup_garmindb.py` — a small interactive helper that prepares and (optionally)
downloads or imports Garmin exports.

Prerequisites
- Python 3.11+ (recommended)
- Optionally install garmindb if you want the official importer features:
	pip install garmindb

Usage (interactive)

1. Copy your Garmin Connect credentials file or prepare a password file. If you have
	 `~/.GarminDb/GarminConnectConfig.json`, the helper can use it. Otherwise create a
	 credentials file with restricted permissions (chmod 600).

2. Run the helper:

```bash
python scripts/setup_garmindb.py
```

The script will prompt for:
- path to an existing Garmin export database, or
- whether to fetch data via configured GarminConnect credentials (if `garmindb` and creds are available)

Typical workflow examples

- Import from a local `GarminDB` directory (offline export):
	1. Place or point the helper to your `~/.GarminDb` folder copy.
	2. Let the helper extract raw activity files and write them under `data/garmindb-import/`.

- Fetch new data from Garmin via API (if configured):
	1. Ensure `garmindb` library and credentials are available.
	2. Run the helper and select the fetch option.

After `setup_garmindb.py` finishes you will have a local set of raw Garmin activity files or
an export location. Next step: migrate/import those files into the project's Postgres database
using the migration scripts in `Diary-AI-BE/` (see `run_migration.py` / `setup_migration.py`).

Security note
- Don't commit or share `GarminConnectConfig.json` or any raw export containing personal data.

---

## Run the project with Docker Compose (recommended)

This repository contains `docker-compose.yml` which launches the backend, a Postgres database,
and optional services. The Docker-based flow isolates dependencies and is the easiest way to
get started.

Start (build and run in background):

```bash
docker compose up -d --build
```

Health check (service should respond on port 5002):

```bash
curl http://localhost:5002/api/stats
```

Launch frontend (optional)
- The repository includes a React frontend under `Diary-AI-FE/frontend-react/`.
- To run the frontend in dev mode:

```bash
cd Diary-AI-FE/frontend-react
npm install
npm start
```

Or include the frontend container via an environment flag / docker compose override (see `docker-compose.yml`).

Environment configuration
- Copy `Diary-AI-BE/config.env.example` to `Diary-AI-BE/config.env` and edit DB credentials,
	secret keys, and any Garmin-related settings.
- Ensure `docker-compose.yml` references the correct env file (it is configured by default)

---

## Helper scripts

These helper scripts automate common maintenance tasks. They are in the repository root and
are convenient for local development.

full_reset.sh
- Purpose: stop containers, remove volumes, rebuild images, run DB migrations and seed data.
- When to use: you want a clean start (wiping local DB/container state).
- Example:

```bash
./full_reset.sh         # interactive: stop, remove volumes, build, migrate
./full_reset.sh --no-cache  # rebuild images without Docker cache
```

What it does (high level):
- docker compose down -v (stops containers and removes named volumes)
- docker compose build --no-cache (optional with flag)
- docker compose up -d
- run backend migration scripts (Alembic / project migration runner)

start_all.sh
- Purpose: start the full stack for development (backend, db, optional frontend)
- Usage:

```bash
./start_all.sh           # start backend + db
./start_all.sh --with-frontend  # also start frontend dev container (if configured)
```

stop_all.sh
- Purpose: stop services started by `start_all.sh` or `docker compose up`.
- Usage:

```bash
./stop_all.sh
# or docker compose down
docker compose down
```

Notes
- These scripts are lightweight wrappers around `docker compose` and the project's migration utilities.
- Inspect the top of each script to see exact commands and optional flags.

---

## Quick developer notes (without Docker)

If you prefer to run services natively:

1. Create virtualenv and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start Postgres locally (or point to a remote DB) and set `Diary-AI-BE/config.env` accordingly.

3. Start backend:

```bash
uvicorn Diary-AI-BE.backend_api_enhanced:app --reload --port 5002
```

4. (Optional) Frontend dev:

```bash
cd Diary-AI-FE/frontend-react
npm install
npm start
```

---

## Project layout (high level)

```
Diary-AI-BE/                # FastAPI backend + migration scripts
Diary-AI-FE/                # React frontend (optional)
scripts/                    # helpers (including setup_garmindb.py)
docker-compose.yml          # local stack orchestration
full_reset.sh               # full cleanup + rebuild
start_all.sh                # start stack (dev)
stop_all.sh                 # stop stack
README.md                   # this file
docs/                       # detailed design & usage docs
```

---

If you'd like, I can also:
- create a short `docs/GETTING_STARTED.md` step-by-step based on your environment (macOS, Docker Desktop),
- open a small PR that adds examples of `setup_garmindb.py` invocation and sample outputs.

Thanks — let me know if you want the README adjusted for a more opinionated workflow (e.g. only Docker, or only native dev).

---

## Full documentation (click to open)

The repository includes a set of detailed docs. Open any of the links below to read the full guidance:

- [GETTING_STARTED.md](docs/GETTING_STARTED.md) — End-to-end setup & first run (recommended first read)
- [DATA_PIPELINE.md](docs/DATA_PIPELINE.md) — Ingestion, migration, and data model details
- [ANALYTICS_ENGINE.md](docs/ANALYTICS_ENGINE.md) — How correlations/clustering/recovery work
- [API_REFERENCE.md](docs/API_REFERENCE.md) — Full list of backend endpoints and examples
- [FRONTEND.md](docs/FRONTEND.md) — Frontend structure, build, and deployment notes
- [USAGE_PATTERNS.md](docs/USAGE_PATTERNS.md) — Common daily workflows and how to interpret results
- [MIGRATIONS.md](docs/MIGRATIONS.md) — Schema migration patterns and reset strategies
- [SCRIPTS.md](docs/SCRIPTS.md) — Explanations of maintenance scripts (if present)

If a link points to a missing file, check the `docs/` directory in the repo root — some docs live in `Diary-AI-BE/`
