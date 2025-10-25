#!/bin/bash
# full_reset.sh — full reset of the database (remove volume), rebuild images,
# start Postgres + backend and run migrations, then (optionally) start frontend locally.
# Usage:
#   ./full_reset.sh                         # reset + migration + backend
#   ./full_reset.sh --with-frontend         # also starts React frontend locally
#   ./full_reset.sh --no-cache              # build without cache
#   ./full_reset.sh --preserve-db           # do NOT remove DB volume; keep existing data and only migrate
#   ./full_reset.sh --no-drop-db            # alias of --preserve-db
#   You can combine flags: ./full_reset.sh --no-cache --with-frontend --preserve-db

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for pretty output
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
NC="\033[0m"

WITH_FRONTEND=0
NO_CACHE=0
RUN_GARMINDb=1  # can be disabled with --skip-garmindb
START_LLM=0
PRESERVE_DB=0  # when 1, do not drop DB volume; only (re)start services and run migrations
UVICORN_WORKERS=""
GARMINDb_MODE="full"  # "full" (default) or "latest"; override with --garmindb-latest

for arg in "$@"; do
  case "$arg" in
    --with-frontend) WITH_FRONTEND=1 ; shift ;;
    --llm) START_LLM=1 ; shift ;;
    --no-cache) NO_CACHE=1 ; shift ;;
    --skip-garmindb) RUN_GARMINDb=0 ; shift ;;
    --garmindb-latest) GARMINDb_MODE="latest" ; shift ;;
    --preserve-db|--no-drop-db) PRESERVE_DB=1 ; shift ;;
    --workers|-w)
      shift
      if [[ -z "${1:-}" ]]; then echo "--workers requires a number"; exit 1; fi
      UVICORN_WORKERS="$1"; shift ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $arg" ; exit 1 ;;
  esac
done

# (0) Optionally: fetch/refresh Garmin data via garmindb_cli.py
# ---------------------------------------------------------------
# The script may run:
#   garmindb_cli.py --all --download --import --analyze --latest
# Assumptions:
#   - Script might be located at ./garmindb_cli.py or Diary-AI-BE/app/cli/garmindb_cli.py
#   - If not present, we warn and continue.
#   - Can be skipped via --skip-garmindb

if [ $RUN_GARMINDb -eq 1 ]; then
  echo "Running initial garmindb step inside Docker (no local venv)..."

  # Run GarminDb in a temporary Python container, with host config/cache mounted for persistence
  GCLI_STATUS=0
  GARMIN_CONFIG_DIR="${HOME}/.GarminDb"
  mkdir -p "$GARMIN_CONFIG_DIR" || true

  # Optional: mount pip cache to speed up repeated runs
  PIP_CACHE_DIR="${HOME}/.cache/pip"
  mkdir -p "$PIP_CACHE_DIR" || true

  # Mount HealthData so downloads persist on host and are visible to backend compose (../HealthData -> /app/HealthData)
  HEALTHDATA_DIR="${HOME}/HealthData"
  mkdir -p "$HEALTHDATA_DIR" || true

  # Note: using --interactive when attached to a TTY so prompts (first-time setup) work
  DOCKER_INTERACTIVE=""
  if [ -t 0 ]; then DOCKER_INTERACTIVE="-it"; fi

  DOCKER_IMAGE="python:3.13.5-slim"
  # Build garmindb args
  GDB_ARGS="--all --download --import --analyze --latest"
  if [ "$GARMINDb_MODE" = "latest" ]; then
    GDB_ARGS="$GDB_ARGS --latest"
  fi
  RUN_CMD='pip install --no-input --disable-pip-version-check -q garmindb fitfile tcxfile fitparse fitdecode idbutils \
    && garmindb_cli.py '"$GDB_ARGS"''

  echo "docker run $DOCKER_INTERACTIVE --rm -v $GARMIN_CONFIG_DIR:/root/.GarminDb -v $PIP_CACHE_DIR:/root/.cache/pip $DOCKER_IMAGE sh -lc \"$RUN_CMD\""
  set +e
  docker run $DOCKER_INTERACTIVE --rm \
    -v "$GARMIN_CONFIG_DIR:/root/.GarminDb" \
    -v "$PIP_CACHE_DIR:/root/.cache/pip" \
    -v "$HEALTHDATA_DIR:/root/HealthData" \
    "$DOCKER_IMAGE" sh -lc "$RUN_CMD"
  GCLI_STATUS=$?
  set -e

  if [ $GCLI_STATUS -ne 0 ]; then
    echo "garmindb exited with code $GCLI_STATUS (continuing reset)."
  else
    echo "garmindb step completed (or skipped without error)"
  fi
else
  echo "Skipping garmindb step (used --skip-garmindb)"
fi

# Detect docker compose
if command -v docker &>/dev/null; then
  DC='docker compose'
elif command -v docker-compose &>/dev/null; then
  DC='docker-compose'
else
  echo "docker / docker-compose not found"; exit 1
fi

# 1. Stop and remove the stack (+ volumes unless preserved)
if [ $PRESERVE_DB -eq 1 ]; then
  echo "Stopping containers without removing DB volume (preserving existing data)..."
  $DC down || true
else
  echo "Stopping containers and removing volumes (database will be cleared)..."
  $DC down -v || true
fi

# 2. (Optional) remove dangling images
if docker images -f dangling=true -q | grep -q .; then
  echo "Removing dangling images..."
  docker rmi $(docker images -f dangling=true -q) || true
fi

# 3. Build fresh images
echo "Building backend images..."
if [ $NO_CACHE -eq 1 ]; then
  $DC build --no-cache --pull
else
  $DC build --pull
fi

echo "Starting the db service (so we can run migrations)..."
$DC up -d db

# 4. Wait for Postgres healthy (healthcheck in compose)
echo "Waiting for Postgres to be healthy..."
for i in {1..30}; do
  status=$(docker inspect -f '{{ .State.Health.Status }}' journal_ai_db 2>/dev/null || echo 'unknown')
  if [ "$status" = "healthy" ]; then
    echo "Postgres is ready"; break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "Postgres did not reach healthy state"; exit 1
  fi
done

# 5. Start backend (and optional LLM)
echo "Starting backend..."
if [[ -n "$UVICORN_WORKERS" ]]; then
  echo "Using UVICORN_WORKERS=${UVICORN_WORKERS}"
  UVICORN_WORKERS="$UVICORN_WORKERS" $DC up -d backend
else
  $DC up -d backend
fi
if [ $START_LLM -eq 1 ]; then
  echo "Starting LLM service..."
  $DC up -d llm || true
fi

# 6. Wait until backend responds
BACKEND_URL="http://localhost:5002/api/health"
echo "Waiting for backend (${BACKEND_URL})..."
for i in {1..60}; do
  if curl -s "$BACKEND_URL" >/dev/null 2>&1; then
    echo "Backend is up"; break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "Backend did not respond within 60s"; exit 1
  fi
done

# 7. Run migration inside backend container
echo "Running migration (run_migration.py)..."
set +e
docker exec journal_ai_backend python run_migration.py --subset all
MIG_STATUS=$?
set -e
if [ $MIG_STATUS -ne 0 ]; then
  echo "Migration failed (code $MIG_STATUS) — check logs: docker compose logs backend"
  exit $MIG_STATUS
fi

echo "Migration finished successfully"

# 8. (Optional) start frontend locally
if [ $WITH_FRONTEND -eq 1 ]; then
  echo "Starting React frontend locally..."
  FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
  if [ ! -d "$FE_DIR" ]; then
    echo "Frontend directory does not exist: $FE_DIR"; exit 1
  fi
  pushd "$FE_DIR" >/dev/null
  if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing dependencies (npm install)...${NC}"
    npm install
  fi
  # find a free port
  for p in {3000..3010}; do
    if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null; then
      FRONTEND_PORT=$p; break
    fi
  done
  echo -e "${GREEN}🌍 Frontend will start at http://localhost:${FRONTEND_PORT}${NC}"
  PORT=$FRONTEND_PORT npm start
  popd >/dev/null
else
  echo -e "${GREEN}🎉 Done: Database reset, migration completed, backend is running at http://localhost:5002${NC}"
  echo -e "${YELLOW}To start frontend: ./full_reset.sh --with-frontend (or ./start_all.sh --with-frontend)${NC}"
fi
