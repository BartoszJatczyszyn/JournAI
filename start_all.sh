#!/bin/bash
set -euo pipefail

# start_all.sh — start services using Docker Compose
# By default: runs the stack with `docker compose up -d --build` and waits for the backend.
# Optionally: pass --with-frontend to start a local React dev server as well.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

WITH_FRONTEND=0
WITH_LLM=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --with-frontend) WITH_FRONTEND=1; shift ;;
        --llm) WITH_LLM=1; shift ;;
        --help|-h) echo "Usage: $0 [--with-frontend] [--llm]"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}🔧 Starting services via Docker Compose...${NC}"

# Prefer `docker compose` (compose v2). If not available, fall back to `docker-compose`.
if command -v docker &>/dev/null; then
    DOCKER_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD="docker-compose"
else
    echo -e "${RED}❌ docker or docker-compose not found. Install Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using: $DOCKER_CMD${NC}"

echo -e "${BLUE}📦 Building and starting services (detached)...${NC}"
SERVICES=(db backend)
if [ "$WITH_LLM" -eq 1 ]; then
  SERVICES+=(llm)
fi
($DOCKER_CMD up -d --build "${SERVICES[@]}") || { echo -e "${RED}❌ Error while starting docker compose${NC}"; exit 1; }

# Wait for backend (health endpoint)
echo -e "${YELLOW}⏳ Waiting for backend at http://localhost:5002/api/stats ...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:5002/api/stats >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend ready at http://localhost:5002${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        echo -e "${RED}❌ Backend did not respond within 60s. Check container logs: $DOCKER_CMD logs <backend>${NC}"
        exit 1
    fi
done

if [ "$WITH_FRONTEND" -eq 1 ]; then
    echo -e "${BLUE}🚀 Starting local React dev server (optional)...${NC}"
    FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
    cd "$FE_DIR"
    # choose the first free port 3000-3010
    for p in {3000..3010}; do
        if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null; then
            FRONTEND_PORT=$p
            break
        fi
    done
    echo -e "${GREEN}🌐 Frontend will be available at: http://localhost:${FRONTEND_PORT}${NC}"
    if [ ! -d node_modules ]; then
        echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
        npm install
    fi
    echo -e "${YELLOW}ℹ️  To stop the frontend press Ctrl+C${NC}"
    trap 'echo -e "${YELLOW}\n🛑 Stopping local frontend...${NC}"; pkill -f "react-scripts" || true; exit 0' SIGINT SIGTERM
    PORT=$FRONTEND_PORT npm start
else
    echo -e "${GREEN}✅ Services started via Docker Compose. Backend should be available at http://localhost:5002${NC}"
    echo -e "${YELLOW}ℹ️  If you also want a local frontend, run: ./start_all.sh --with-frontend${NC}"
fi