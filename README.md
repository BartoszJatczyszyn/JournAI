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
- Period comparisons & personalized optimization insights
- Sleep / Stress / Activity deep‑dive analytics modules
- CLI + scripts for migrations, journal updates, data refresh
- Optional React frontend dashboard (hot‑reload dev mode)

---

## 🚀 Quick Start (Docker Recommended)
```bash
# 1. Start database + backend
docker compose up -d --build

# 2. Health check
curl http://localhost:5002/api/stats

# 3. (Optional) Launch frontend
./start_all.sh --with-frontend
```
If `/api/stats` returns JSON, you’re live.

More deployment and advanced usage: see `docs/GETTING_STARTED.md`.

---

## 📦 Repository Layout
| Path | Description |
|------|-------------|
| `Diary-AI-BE/` | FastAPI backend source & scripts |
| `Diary-AI-BE/scripts/blueprints/` | API route modules (routers) |
| `Diary-AI-FE/frontend-react/` | Optional React frontend |
| `archive/` | Legacy scripts & historical docs |
| `docs/` | Current documentation set |
| `docker-compose.yml` | Backend + Postgres orchestration |
| `scripts/setup_garmindb.py` | Garmin raw data bootstrap helper |
| `full_reset.sh` | One‑shot clean rebuild + migration |

---

## 🧠 Core Concepts
| Area | Summary |
|------|---------|
| Data Ingestion | Use `garmindb` (optional) → migrate into Postgres via scripts |
| Journal | Daily qualitative metrics (mood, supplements, sleep env) enriching analytics |
| Enhanced Analytics | Aggregates multi‑domain health signals, runs ML/stat analysis |
| Predictions | Lightweight models (regression / forests) for short‑term forecasting |
| Recovery | Pattern & trend analysis with optional inter‑period comparison |

---

## 🔌 Primary API Endpoints (Sample)
```text
GET /api/stats
GET /api/analytics/enhanced/correlations?days=90
GET /api/analytics/enhanced/clusters?days=90&clusters=4
GET /api/analytics/enhanced/recovery?days=90&compare=true
GET /api/analytics/activity/comprehensive?days=30
GET /api/predictions/energy?days_ahead=7
GET /api/insights/personalized?days=90
GET /api/analytics/compare/periods?period1_days=30&period2_days=30&offset_days=30
```
Full list: `docs/API_REFERENCE.md`.

---

## 🛠 Development (Non‑Docker)
Prereqs: Python 3.11+ (recommended), Node.js LTS (frontend only)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn Diary-AI-BE.backend_api_enhanced:app --reload --port 5002
```
Open http://localhost:5002/docs for auto-generated OpenAPI.

---

## 🔐 Security Notes
- Never commit `~/.GarminDb/GarminConnectConfig.json`
- Prefer password-file mode (chmod 600) when using `setup_garmindb.py`
- Treat exports / backups as sensitive (PII / health data)

---

## 🧪 Testing & Validation (suggested pattern)
```bash
pytest -q                # if tests added
ruff check .             # lint (if ruff configured)
uvicorn ... --reload     # manual smoke
```
Add lightweight endpoint tests for regression resilience.

---

## ♻️ Maintenance Quick Commands
```bash
docker compose up -d --build backend   # Rebuild backend only
./full_reset.sh --no-cache             # Full clean rebuild
python scripts/setup_garmindb.py       # Interactive raw data bootstrap
```

---

## 📚 Documentation Index
| File | Purpose |
|------|---------|
| `docs/GETTING_STARTED.md` | End‑to‑end setup & first run |
| `docs/DATA_PIPELINE.md` | Ingestion, migration, journal model |
| `docs/ANALYTICS_ENGINE.md` | Correlations, clustering, recovery internals |
| `docs/API_REFERENCE.md` | Endpoint catalog & response examples |
| `docs/FRONTEND.md` | React dashboard features & build notes |
| `docs/USAGE_PATTERNS.md` | Daily workflows & actionable scenarios |
| `docs/MIGRATIONS.md` | Schema/data migration & reset strategies |

---
## Minimal Command Reference
```bash
# Start core stack
docker compose up -d --build
# Stop (keep data)
docker compose down
# Stop + wipe data
docker compose down -v
# Full clean + migration
./full_reset.sh
# Garmin setup (interactive)
python scripts/setup_garmindb.py
# Update garmindb
pip install --upgrade garmindb
# Health check
curl http://localhost:5002/api/stats
```

---
