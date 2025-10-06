#!/bin/bash

# stop_all.sh — stop the stack started by Docker Compose and clean local frontend/backend processes

echo "🛑 Stopping Garmin Health Dashboard..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Prefer docker compose down
if command -v docker &>/dev/null; then
	echo -e "${YELLOW}🔧 Running: docker compose down${NC}"
	docker compose down || echo -e "${YELLOW}⚠️ docker compose down failed or was not running${NC}"
elif command -v docker-compose &>/dev/null; then
	echo -e "${YELLOW}🔧 Running: docker-compose down${NC}"
	docker-compose down || echo -e "${YELLOW}⚠️ docker-compose down failed or was not running${NC}"
else
	echo -e "${YELLOW}⚠️ docker / docker-compose not found — skipping this part${NC}"
fi

# Additional cleanup of local processes (if someone ran the frontend locally)
echo -e "${YELLOW}🔍 Stopping local React/Python processes (if any)...${NC}"
pkill -f "react-scripts" 2>/dev/null && echo -e "${GREEN}✅ React stopped${NC}" || echo -e "${YELLOW}⚠️  No React processes to stop${NC}"
pkill -f "start_enhanced_backend.py" 2>/dev/null || true
pkill -f "python.*backend" 2>/dev/null && echo -e "${GREEN}✅ Backend (local) stopped${NC}" || echo -e "${YELLOW}⚠️  No local backend processes to stop${NC}"

# Free common ports if they are in use
for port in 3000 5001 5002; do
	if lsof -ti:$port >/dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port $port freed${NC}"
	else
			echo -e "${YELLOW}⚠️  Port $port was free${NC}"
	fi
done

echo -e \"${GREEN}✅ All servers stopped / resources cleaned up${NC}\"