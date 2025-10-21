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

WITH_FRONTEND=0
NO_CACHE=0
RUN_GARMINDb=1  # can be disabled with --skip-garmindb
START_LLM=0
PRESERVE_DB=0  # when 1, do not drop DB volume; only (re)start services and run migrations

for arg in "$@"; do
  case "$arg" in
    --with-frontend) WITH_FRONTEND=1 ; shift ;;
    --llm) START_LLM=1 ; shift ;;
    --no-cache) NO_CACHE=1 ; shift ;;
    --skip-garmindb) RUN_GARMINDb=0 ; shift ;;
    --preserve-db|--no-drop-db) PRESERVE_DB=1 ; shift ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $arg" ; exit 1 ;;
  esac
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# (0) Optionally: fetch/refresh Garmin data via garmindb_cli.py
# ---------------------------------------------------------------
# The script may run:
#   garmindb_cli.py --all --download --import --analyze --latest
# Assumptions:
#   - Script might be located at ./garmindb_cli.py or Diary-AI-BE/scripts/cli/garmindb_cli.py
#   - If not present, we warn and continue.
#   - Can be skipped via --skip-garmindb

if [ $RUN_GARMINDb -eq 1 ]; then
  echo -e "${BLUE}📥 Running initial garmindb step (download/import/analyze/latest) using project venv if available...${NC}"

  # Prefer project venv Python regardless of installed packages
  get_project_python() {
    if [ -x "${SCRIPT_DIR}/.venv/bin/python" ]; then echo "${SCRIPT_DIR}/.venv/bin/python"; return 0; fi
    if [ -x "${SCRIPT_DIR}/../AI/.venv/bin/python" ]; then echo "${SCRIPT_DIR}/../AI/.venv/bin/python"; return 0; fi
    return 1
  }

  GCLI_STATUS=0
  PROJ_PY="$(get_project_python || echo '')"
  if [ -n "$PROJ_PY" ]; then
    echo -e "${BLUE}▶️  Using project Python: $PROJ_PY${NC}"
    set +e
    "$PROJ_PY" -m pip install -q --disable-pip-version-check garmindb fitparse fitfile fitdecode idbutils >/dev/null 2>&1
    set -e
    echo -e "${BLUE}▶️  $PROJ_PY -m garmindb --all --download --import --analyze --latest${NC}"
    set +e; "$PROJ_PY" -m garmindb --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
  else
    # Fallback: try whatever is globally available
    if command -v garmindb_cli.py >/dev/null 2>&1; then
      echo -e "${BLUE}▶️  garmindb_cli.py --all --download --import --analyze --latest${NC}"
      set +e; garmindb_cli.py --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
    elif command -v garmindb >/dev/null 2>&1; then
      echo -e "${BLUE}▶️  garmindb --all --download --import --analyze --latest${NC}"
      set +e; garmindb --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
    else
      echo -e "${YELLOW}⚠️  garmindb command not found (skipping step). Install: pip install garmindb or use --skip-garmindb.${NC}"
      GCLI_STATUS=0
    fi
  fi

  if [ $GCLI_STATUS -ne 0 ]; then
    echo -e "${RED}⚠️  garmindb exited with code $GCLI_STATUS (continuing reset).${NC}"
  else
    echo -e "${GREEN}✅ garmindb step completed (or skipped without error)${NC}"
  fi
else
  echo -e "${YELLOW}⏭  Skipping garmindb step (used --skip-garmindb)${NC}"
fi

# Detect docker compose
if command -v docker &>/dev/null; then
  DC='docker compose'
elif command -v docker-compose &>/dev/null; then
  DC='docker-compose'
else
  echo -e "${RED}❌ docker / docker-compose not found${NC}"; exit 1
fi

# 1. Stop and remove the stack (+ volumes unless preserved)
if [ $PRESERVE_DB -eq 1 ]; then
  echo -e "${BLUE}🧹 Stopping containers without removing DB volume (preserving existing data)...${NC}"
  $DC down || true
else
  echo -e "${BLUE}🧹 Stopping containers and removing volumes (database will be cleared)...${NC}"
  $DC down -v || true
fi

# 2. (Optional) remove dangling images
if docker images -f dangling=true -q | grep -q .; then
  echo -e "${YELLOW}🗑  Removing dangling images...${NC}"
  docker rmi $(docker images -f dangling=true -q) || true
fi

# 3. Build fresh images
echo -e "${BLUE}🏗  Building backend images...${NC}"
if [ $NO_CACHE -eq 1 ]; then
  $DC build --no-cache --pull
else
  $DC build --pull
fi

echo -e "${BLUE}🐘 Starting the db service (so we can run migrations)...${NC}"
$DC up -d db

# 4. Wait for Postgres healthy (healthcheck in compose)
echo -e "${YELLOW}⏳ Waiting for Postgres to be healthy...${NC}"
for i in {1..30}; do
  status=$(docker inspect -f '{{ .State.Health.Status }}' journal_ai_db 2>/dev/null || echo 'unknown')
  if [ "$status" = "healthy" ]; then
    echo -e "${GREEN}✅ Postgres is ready${NC}"; break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Postgres did not reach healthy state${NC}"; exit 1
  fi
done

# 5. Start backend (and optional LLM)
echo -e "${BLUE}🚀 Starting backend...${NC}"
$DC up -d backend
if [ $START_LLM -eq 1 ]; then
  echo -e "${BLUE}🧠 Starting LLM service...${NC}"
  $DC up -d llm || true
fi

# 6. Wait until backend responds
BACKEND_URL="http://localhost:5002/api/stats"
echo -e "${YELLOW}⏳ Waiting for backend (${BACKEND_URL})...${NC}"
for i in {1..60}; do
  if curl -s "$BACKEND_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is up${NC}"; break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo -e "${RED}❌ Backend did not respond within 60s${NC}"; exit 1
  fi
done

# 7. Run migration inside backend container
echo -e "${BLUE}📦 Running migration (run_migration.py)...${NC}"
set +e
docker exec journal_ai_backend python run_migration.py --subset all
MIG_STATUS=$?
set -e
if [ $MIG_STATUS -ne 0 ]; then
  echo -e "${RED}❌ Migration failed (code $MIG_STATUS) — check logs: docker compose logs backend${NC}"
  exit $MIG_STATUS
fi

echo -e "${GREEN}✅ Migration finished successfully${NC}"

# 8. (Optional) start frontend locally
if [ $WITH_FRONTEND -eq 1 ]; then
  echo -e "${BLUE}🌐 Starting React frontend locally...${NC}"
  FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
  if [ ! -d "$FE_DIR" ]; then
    echo -e "${RED}❌ Frontend directory does not exist: $FE_DIR${NC}"; exit 1
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
