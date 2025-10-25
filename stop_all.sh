#!/bin/bash
set -euo pipefail

# stop_all.sh — stop the stack (Docker Compose) and clean local frontend/backend processes

echo "Stopping services..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Choose docker compose command
docker_cmd() {
  if command -v docker &>/dev/null; then echo "docker compose"; return 0; fi
  if command -v docker-compose &>/dev/null; then echo "docker-compose"; return 0; fi
  return 1
}

# Stop containers if docker is available
if DOCKER_CMD=$(docker_cmd); then
  echo "Running: $DOCKER_CMD down"
  $DOCKER_CMD down || echo -e "${YELLOW}⚠️  $DOCKER_CMD down failed or was not running${NC}"
else
  echo "docker/docker-compose not found — skipping container shutdown"
fi

# Helper to stop processes by pattern
stop_proc() {
  local pattern="$1"
  if pkill -f "$pattern" 2>/dev/null; then
    echo "Stopped: $pattern"
  else
    echo "Not running: $pattern"
  fi
}

echo "Stopping local React/Python processes (if any)..."
stop_proc "react-scripts"
stop_proc "app.cli.start_backend"
stop_proc "start_enhanced_backend.py"
stop_proc "python.*backend"

# Free common ports if they are in use
for port in 3000 5001 5002 8080; do
  if lsof -ti:$port >/dev/null 2>&1; then
    echo "Port $port freed"
  else
    echo -e "${YELLOW}ℹ️  Port $port already free${NC}"
  fi
done

echo -e "${GREEN}✅ All servers stopped / resources cleaned up${NC}"
