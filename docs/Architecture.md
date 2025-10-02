# Architecture Overview

This project is split into three friendly pieces that assemble like the Avengers:

1) Storage (PostgreSQL)
- Container `db` from docker-compose (postgres:16-alpine)
- Data stored in docker volume `pg_data`
- Tables include: `garmin_daily_summaries`, `garmin_sleep_sessions`, `garmin_activities`, `garmin_weight`, `daily_journal`, and more created by migrations

2) Backend (FastAPI)
- Location: `AI/Diary-AI-BE`
- Entrypoint: `scripts/backend_api_enhanced.py` (exported via top-level `backend_api_enhanced.py`)
- Served by `uvicorn` on port 5002
- Loads environment from `AI/Diary-AI-BE/config.env` if present
- Mounts modular routers under `/api`:
  - `core`: `/api/stats`, `/api/health-data`
  - `sleeps`: `/api/sleeps/latest`, `/api/sleeps/{sleep_id}`
  - `activities`: `/api/activities/latest`, `/api/activities/{activity_id}`
  - `trends`: `/api/trends/health`
  - `insights`: `/api/insights/personalized`, `/api/insights/optimization`
  - `predictions`: `/api/predictions/*` (energy, sleep, mood, comprehensive)
  - `admin`: `/api/admin/models/retrain`
  - `journal` and `gym` blueprints also included
- OpenAPI & Swagger UI at `/api/docs`

Analytics engines
- `EnhancedHealthAnalytics` for comprehensive insights and correlations
- `PredictiveHealthAnalytics` for forecasts
- Specialized: `SleepAnalytics`, `StressAnalytics`, `ActivityAnalytics`

3) Frontend (React)
- Location: `AI/Diary-AI-FE/frontend-react`
- Dev server via `react-scripts start`, proxy set to `http://localhost:5002`

Data flow
- Your Garmin export sits in `HealthData/` at repo root
- Migrations parse it into normalized tables in Postgres
- Backend serves analytics and aggregates from those tables
- Frontend renders metrics, trends, predictions, and journals

Security & ops notes
- Raw export is mounted read-only into backend container
- Admin endpoint can clear cached models to trigger retraining
- CORS currently permissive for local development—tighten for production

Where to look for what
- Compose & scripts: `AI/`
- Backend app & routers: `AI/Diary-AI-BE/scripts/`
- Migrations: `AI/Diary-AI-BE/scripts/migrations/`
- Frontend app: `AI/Diary-AI-FE/frontend-react/`

"What do they call it? Ah yes—human ingenuity." — Vision (probably about your DIY health analytics stack)
