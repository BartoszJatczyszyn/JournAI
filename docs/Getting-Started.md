# Getting Started

This guide walks you from zero to charts with the least yak-shaving possible.

## Prerequisites
- Docker Desktop (recommended path)
- Node.js ≥ 18 (for the frontend dev server)
- Optional: Python 3.13 (if running backend locally without Docker)

## 1) Put your Garmin export in place
- Create or verify a `HealthData/` folder at the repository root (same level as `AI/`).
- Drop your Garmin export there. The backend container mounts it read-only at `/app/HealthData`.

## 1.5) Optional: Prepare GarminDb and download data
An interactive helper can configure `garmindb` and fetch your data.
- Run:
     python AI/Diary-AI-BE/app/cli/setup_garmindb.py
- What it does:
  - Installs/updates `garmindb`
  - Writes `~/.GarminDb/GarminConnectConfig.json` with your username, dates, and paths
  - Optionally stores your password in a separate file (chmod 600)
  - Can immediately run: `--all --download --import --analyze` (plus `--latest`)
- Non-interactive example:
     python AI/Diary-AI-BE/app/cli/setup_garmindb.py --username you@example.com --start-date 11/01/2024 --latest
Tip: Ensure the resulting `HealthData` directory matches what your migrations will read.

## 2) Launch the stack
From the `AI/` directory:
     ./start_all.sh
This builds and starts:
- Postgres at localhost:5432
- Backend (FastAPI) at http://localhost:5002
The script waits until `GET /api/stats` is reachable.

Want the React dashboard too? Add `--with-frontend`:
     ./start_all.sh --with-frontend
It’ll find the first free port between 3000–3010.

Stop everything later with:
     ./stop_all.sh

## 3) Import your data (migrations)
Run inside the backend container:
- Full import:
     docker compose exec backend python run_migration.py --subset all
- Targeted subsets:
     docker compose exec backend python run_migration.py --subset sleep
Available subsets: all, daily, sleep, rhr, stress, hr, rr, activities, weight, journal, stats

If running locally without Docker:
     python AI/Diary-AI-BE/setup_migration.py
     python AI/Diary-AI-BE/run_migration.py --subset all

## 3.5) Optional: Reset from scratch (fresh DB + rebuild + migrate)
Need a clean slate and a one-command rebootstrap? Use:
     ./full_reset.sh
Options:
- --with-frontend    Also start the local React dev server after migration
- --no-cache         Rebuild Docker images without using cache
- --skip-garmindb    Skip the pre-reset garmindb download/import step
- --help             Show usage and exit
What it does: stops and removes containers and volumes (wipes DB), rebuilds, starts DB and backend, runs full migration, and optionally launches the frontend.
Caution: This removes the Postgres volume (you lose previous DB data).

## 4) Explore the API
- OpenAPI docs: http://localhost:5002/api/docs
- Health check: `GET /api/health`
- Stats: `GET /api/stats`
- Sleeps: `GET /api/sleeps/latest?limit=20`
- Trends: `GET /api/trends/health?days=90`
- Insights: `GET /api/insights/personalized?days=60`
- Predictions: `GET /api/predictions/energy?days_ahead=7`

## 5) Run the frontend
From `AI/Diary-AI-FE/frontend-react`:
     npm install
     npm start
Open the printed URL (usually http://localhost:3000). The dev server proxies `/api/*` to the backend.

## Configuration reference
- Backend example env: `AI/Diary-AI-BE/config.env.example` (copy to `config.env` to customize)
- Docker compose overrides: `AI/.env.docker.example` (copy to `AI/.env` to customize)

Tip: Use `docker compose logs -f backend` to follow backend logs during imports.

That’s it—queue montage music and enjoy your dashboards.
