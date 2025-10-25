#!/bin/bash
set -euo pipefail

# start_all.sh — start services using Docker Compose
# Flags:
#   --with-frontend        Start local React dev server
#   --llm                  Start LLM service
#   --workers|-w N         Set backend worker count
#   --first-boot-setup     Force GarminDb setup prompt even if already done
#   --yes|-y               Auto-accept GarminDb setup prompt
#   --help|-h              Show usage

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

WITH_FRONTEND=0
WITH_LLM=0
UVICORN_WORKERS=""
FORCE_SETUP=0
SKIP_SETUP_PROMPT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-frontend) WITH_FRONTEND=1; shift ;;
    --llm) WITH_LLM=1; shift ;;
    --workers|-w) shift; [[ -z "${1:-}" ]] && { echo "--workers requires a number"; exit 1; }; UVICORN_WORKERS="$1"; shift ;;
    --first-boot-setup) FORCE_SETUP=1; shift ;;
    --yes|-y) SKIP_SETUP_PROMPT=1; shift ;;
    --help|-h)
      echo "Usage: $0 [--with-frontend] [--llm] [--workers N] [--first-boot-setup] [--yes]"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Select docker compose command
docker_cmd() {
  if command -v docker &>/dev/null; then echo "docker compose"; return 0; fi
  if command -v docker-compose &>/dev/null; then echo "docker-compose"; return 0; fi
  echo "docker or docker-compose not found" >&2; return 1
}

DOCKER_CMD=$(docker_cmd) || exit 1

# First-boot GarminDb setup (optional)
SETUP_FLAG_FILE="$SCRIPT_DIR/.first_boot_setup_done"
maybe_run_setup() {
  local do_setup=0
  if [[ $FORCE_SETUP -eq 1 || ! -f "$SETUP_FLAG_FILE" ]]; then do_setup=1; fi
  if [[ $do_setup -eq 1 ]]; then
    local reply
    if [[ $SKIP_SETUP_PROMPT -eq 1 ]]; then
      reply="y"
    else
      read -r -p "Run GarminDb setup now? [Y/n] " reply
    fi
    reply=${reply:-Y}
    if [[ "$reply" =~ ^[Yy]$ ]]; then
      if [[ -x "$SCRIPT_DIR/setup_garmindb.sh" ]]; then
        "$SCRIPT_DIR/setup_garmindb.sh" || echo "GarminDb setup failed (you can re-run: ./setup_garmindb.sh)"
        [[ $FORCE_SETUP -eq 0 ]] && touch "$SETUP_FLAG_FILE"
      else
        echo "Missing setup script: $SCRIPT_DIR/setup_garmindb.sh"
      fi
    else
      [[ $FORCE_SETUP -eq 0 ]] && touch "$SETUP_FLAG_FILE"
    fi
  fi
}

maybe_run_setup

# Build and start services
SERVICES=(db backend)
[[ "$WITH_LLM" -eq 1 ]] && SERVICES+=(llm)
if [[ -n "$UVICORN_WORKERS" ]]; then
  (UVICORN_WORKERS="$UVICORN_WORKERS" $DOCKER_CMD up -d --build "${SERVICES[@]}") || { echo "Error starting docker compose"; exit 1; }
else
  ($DOCKER_CMD up -d --build "${SERVICES[@]}") || { echo "Error starting docker compose"; exit 1; }
fi

echo "Waiting for backend (http://localhost:5002/api/health) ..."
for i in {1..60}; do
  if curl -sf "http://localhost:5002/api/health" >/dev/null 2>&1; then
    echo "Backend ready at http://localhost:5002"; break
  fi
  sleep 1
  [[ $i -eq 60 ]] && { echo "Backend did not respond within 60s"; exit 1; }
done

if [[ "$WITH_FRONTEND" -eq 1 ]]; then
  FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
  cd "$FE_DIR"
  # pick free port 3000-3010
  for p in {3000..3010}; do
    if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null; then FRONTEND_PORT=$p; break; fi
  done
  echo "Frontend: http://localhost:${FRONTEND_PORT}"
  if [[ ! -d node_modules ]]; then npm install; fi
  trap 'pkill -f "react-scripts" || true; exit 0' SIGINT SIGTERM
  PORT=$FRONTEND_PORT npm start
else
  echo "Services started. Backend: http://localhost:5002"
  echo "To start the frontend: ./start_all.sh --with-frontend"
fi
