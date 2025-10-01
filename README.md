# JournAI

A local analytics platform for your Garmin / health data. It ingests, stores, enriches and serves analytics via a lightweight backend API (Flask) and optionally a React frontend. The preferred way to run everything is Docker Compose (Postgres + enhanced backend). A helper script simplifies the initial Garmin data setup.

---

## 1. TL;DR – Run Everything in 3 Commands
```bash
# Clone (example path)
# git clone <your-fork-or-repo-url> && cd AI

# Start database + backend
docker compose up -d --build

# Check API health
curl http://localhost:5002/api/stats
```
If you see JSON stats, the backend is live.

Optional (React dev frontend – separate repo folder): start later with `./start_all.sh --with-frontend`.

---

## 2. What You Get
- PostgreSQL 16 for structured long‑term storage.
- Enhanced Analytics Backend (Flask) on port 5002.
- Scripts for importing / migrating Garmin-derived datasets.
- Optional integration with `garmindb` to download raw Garmin data first (SQLite → then enriched into Postgres).
- Utilities for full resets, selective migrations, and feature view refresh.

---

## 3. Prerequisites
| Component | Required | Notes |
|-----------|----------|-------|
| Docker + Compose v2 | Yes | Primary runtime path |
| Python 3.10+ | Recommended | For helper scripts outside containers |
| Node.js (LTS) | Optional | Only if running local React dev frontend |

---

## 4. First-Time Garmin Data Setup (garmindb)
If you want to pull your own Garmin data locally before analytics, run the interactive setup script. This creates `~/.GarminDb/GarminConnectConfig.json` and (optionally) performs the first full import.

```bash
python scripts/setup_garmindb.py
```
You will be asked for:
- Garmin username (email)
- Password (choose: store directly in JSON OR in a protected file with chmod 600)
- Start date(s) (single date or individual dates for sleep / rhr / monitoring / weight)
- Whether to immediately run: `--all --download --import --analyze` (+ optionally `--latest`)

Non‑interactive example:
```bash
python scripts/setup_garmindb.py \
  --username you@example.com \
  --start-date 11/01/2024 \
  --use-password-file \
  --full --latest
```

Manual password entry (without password file):
```bash
python scripts/setup_garmindb.py \
   --username you@example.com \
   --start-date 11/01/2024 \
   --full --latest
```
During the run you will be prompted for the password (hidden). When asked:
   Zapisać hasło w osobnym pliku (zalecane)? [Y/n]
answer `n` if you do NOT want a separate password file. In that case the password is stored directly in `GarminConnectConfig.json` (less secure). If you answer `y` or pass `--use-password-file`, it will be written to `~/.GarminDb/password.txt` with permissions `600` and the JSON will only reference the file.

Security trade‑off summary:
- Password file (recommended): plaintext in dedicated file with `chmod 600`, JSON omits the password.
- Direct JSON storage: quickest, but any tooling or accidental sharing of the JSON exposes the secret.
- (Future option) Ephemeral / no storage: not yet implemented; would require passing credentials only at runtime.

Later manual runs:
```bash
python -m garmindb.garmindb_cli --all --download --import --analyze --latest
python -m garmindb.garmindb_cli --backup         # backup local SQLite store
pip install --upgrade garmindb                  # update tool
```

If you already have Postgres ingestion scripts, you may skip garmindb entirely and feed your own sources.

---

## 5. Starting & Stopping the Stack
Basic:
```bash
docker compose up -d --build   # start / rebuild if needed
docker compose down            # stop (keeps volumes)
docker compose down -v         # stop AND remove database volume (data loss)
```
Helper scripts (wrap extra logic):
```bash
./start_all.sh                 # docker stack only
./start_all.sh --with-frontend # also launch React dev server if available
./stop_all.sh                  # stop stack + clean stray local processes
```

---

## 6. Full Environment Reset + Fresh Migration
If you want a clean slate:
```bash
./full_reset.sh
```
Common flags:
```bash
./full_reset.sh --with-frontend   # also start frontend
./full_reset.sh --no-cache        # force rebuild images from scratch
./full_reset.sh --skip-garmindb   # skip initial garmindb CLI call
```
What it does (sequence):
1. (Optional) Runs garmindb CLI to refresh raw data.
2. `docker compose down -v` (wipe DB volume).
3. Rebuilds containers.
4. Starts Postgres, waits for readiness.
5. Starts backend, waits for `/api/stats`.
6. Executes full migration script inside backend container.
7. (Optional) Starts React dev frontend.

Use this when schema or migration logic changes and you need reproducible state.

---

## 7. Directory Structure (Essentials)
| Path | Purpose |
|------|---------|
| `Diary-AI-BE/` | Backend source (Flask, analytics, migrations) |
| `Diary-AI-BE/scripts/` | Operational / migration / analytics scripts |
| `Diary-AI-FE/frontend-react/` | Optional React dev frontend |
| `docker-compose.yml` | Orchestrates Postgres + backend |
| `scripts/setup_garmindb.py` | Interactive Garmin data bootstrap |
| `full_reset.sh` | Clean rebuild & migration pipeline |
| `start_all.sh` / `stop_all.sh` | Convenience lifecycle scripts |
| `archive/` | Legacy or reference scripts & docs |
| `docs/` | Extended guides & internal documentation |

---

## 8. Backend API – Quick Probe
Health / stats:
```bash
curl http://localhost:5002/api/stats
```
Example analytics endpoint (adjust days):
```bash
curl "http://localhost:5002/api/analytics/enhanced/correlations?days=30"
```
If you get structured JSON, the service is functioning. More specialized endpoints may exist under `/api/analytics/...` – explore or open the source in `Diary-AI-BE/backend_api_enhanced.py`.

---

## 9. Frontend (Optional)
Dev-only React UI (hot reload):
```bash
./start_all.sh --with-frontend
```
It will look for a free port (3000–3010). For production you can later build and serve static assets separately (`npm run build`). Frontend is not required for API / data workflows.

---

## 10. Typical Daily Flow
1. Update raw Garmin data (optional):
   ```bash
   python -m garmindb.garmindb_cli --all --download --import --analyze --latest
   ```
2. Refresh analytics / views (example):
   ```bash
   docker exec -it backend python Diary-AI-BE/scripts/refresh_features_view.py
   ```
3. Query API or open frontend.
4. Periodically backup:
   ```bash
   python -m garmindb.garmindb_cli --backup
   docker exec -it db pg_dump -U postgres postgres > pg_backup.sql
   ```

---

## 11. Maintenance & Updates
Update analytics code: pull / merge changes then rebuild backend:
```bash
git pull
docker compose up -d --build backend
```
Update garmindb:
```bash
pip install --upgrade garmindb
```
Rotate password (if using password file):
```bash
nano ~/.GarminDb/password.txt   # edit
chmod 600 ~/.GarminDb/password.txt
```
If changing username/password in JSON, ensure the backend or CLI is restarted for new sessions.

---

## 12. Backups
| Layer | Method | Notes |
|-------|--------|-------|
| GarminDb SQLite | `python -m garmindb.garmindb_cli --backup` | Stored under `~/.GarminDb` |
| Postgres | `pg_dump` or volume snapshot | Use host cron / manual scripts |
| Config | Copy `~/.GarminDb/GarminConnectConfig.json` | Avoid committing secrets |

Consider a simple cron entry for Postgres daily dumps + pruning old files.

---

## 13. Security Notes
- Avoid committing `GarminConnectConfig.json` (it lives in your HOME dir, not repo).
- Prefer password file mode (created with `chmod 600`).
- Do not store real credentials in shared screenshots or logs.
- For hardened setups, consider: OS keychain, Vault, or environment variable indirection.

---

## 14. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| `curl /api/stats` hangs | Backend not ready | Check `docker compose logs backend` |
| DB connection errors | Postgres init lag | Wait; ensure no port conflict |
| 500 errors on analytics | Missing migrations | Re-run migration script or `full_reset.sh` |
| garmindb auth fails | Bad credentials / 2FA / locale | Re-run setup script, verify login on web |
| Frontend not opening | Port in use | Free port 3000 or let script auto-select |

Log inspection:
```bash
docker compose logs -f backend
docker compose logs -f db
```

---

## 15. Extending / Next Steps
- Add scheduled refresh (cron + CLI script) for nightly analytics.
- Add Grafana / BI layer querying Postgres directly.
- Harden secrets management (Vault, AWS Secrets Manager, etc.).
- Export derived metrics to external warehouse.

Open an issue or leave a note if you want automation for any of these.

---

## 16. Minimal Command Reference
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

## 17. Disclaimer
This project is for personal analytics. Use at your own risk. Respect Garmin's terms of service. Do not expose credentials or personal health data publicly.

---

Need a slimmer variant, production hardening tips, or CI pipeline instructions? Ask and we can add a focused section.


