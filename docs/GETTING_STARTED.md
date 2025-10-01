# GETTING STARTED

This guide walks you through a clean install, data bootstrap, and first analytics calls.

## 1. Prerequisites
| Tool | Required | Notes |
|------|----------|-------|
| Docker + Compose v2 | Recommended | Simplest runtime path |
| Python 3.11+ | Yes (scripts) | Local helper + CLI tools |
| Node.js LTS | Optional | Only for React frontend |

## 2. Clone & Enter
```bash
git clone <your-repo-url> JournAI && cd JournAI/AI
```
(Adjust path if different layout in your fork.)

## 3. Environment Variables
Create `config.env` (or copy example from backend folder if present):
```
POSTGRES_USER=diary_user
POSTGRES_PASSWORD=diary_pass
POSTGRES_DB=diary
POSTGRES_PORT=5432
POSTGRES_HOST=db
```
Additional variables (optional) can live in `.env` for local runs.

## 4. Start the Stack
```bash
docker compose up -d --build
curl http://localhost:5002/api/stats
```
If JSON returns → backend healthy.

## 5. (Optional) Garmin Raw Data Bootstrap
```bash
python scripts/setup_garmindb.py
```
Choose:
- Username / password storage mode
- Start date(s)
- Initial full import or staged

Later refresh raw data:
```bash
python -m garmindb.garmindb_cli --all --download --import --analyze --latest
```

## 6. Run Migrations (if not auto-run)
Most flows embed migration inside startup scripts. Manual example:
```bash
docker exec -it backend python Diary-AI-BE/run_migration.py
```

## 7. Explore the API
Interactive docs:
```
http://localhost:5002/docs
```
Sample calls:
```bash
curl "http://localhost:5002/api/analytics/enhanced/correlations?days=60"
curl "http://localhost:5002/api/predictions/energy?days_ahead=7"
```

## 8. Optional Frontend
```bash
./start_all.sh --with-frontend
```
Opens on first free port (3000+). If you only need API, skip this.

## 9. Daily Workflow Snapshot
```bash
# Refresh raw
python -m garmindb.garmindb_cli --all --download --import --analyze --latest
# Add journal entry
python archive/journal_cli.py --date today --mood good --meditated true
# Query analytics
curl http://localhost:5002/api/analytics/enhanced/comprehensive?days=90
```

## 10. Resetting Everything
```bash
./full_reset.sh --no-cache
```
Sequence:
1. Optionally refresh raw via garmindb
2. Drop volume + rebuild images
3. Re-run migrations
4. Warm backend & verify

## 11. Troubleshooting Quick Table
| Symptom | Action |
|---------|--------|
| 500 on analytics | Check migrations complete; inspect backend logs |
| DB connect errors | Ensure container up; `docker compose ps`; wait a few seconds |
| Slow first call | Model warm-up; subsequent calls faster |
| Frontend 404s | Confirm API URL / proxy config |

## 12. Next Steps
- Read `docs/ANALYTICS_ENGINE.md` for deeper capabilities
- Add basic endpoint tests
- Experiment with period comparisons for seasonal insights

Enjoy exploring your data 🚀
