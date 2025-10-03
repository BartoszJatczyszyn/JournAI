#!/bin/bash

# stop_all.sh — stop the stack started by Docker Compose and clean local frontend/backend processes

echo "🛑 Zatrzymywanie Garmin Health Dashboard..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Preferuj docker compose down
if command -v docker &>/dev/null; then
	echo -e "${YELLOW}🔧 Running: docker compose down${NC}"
	docker compose down || echo -e "${YELLOW}⚠️ docker compose down failed or was not running${NC}"
elif command -v docker-compose &>/dev/null; then
	echo -e "${YELLOW}🔧 Running: docker-compose down${NC}"
	docker-compose down || echo -e "${YELLOW}⚠️ docker-compose down failed or was not running${NC}"
else
	echo -e "${YELLOW}⚠️ docker / docker-compose not found — skipping this part${NC}"
fi

# Dodatkowe czyszczenie lokalnych procesów (jeśli ktoś uruchomił frontend lokalnie)
echo -e "${YELLOW}🔍 Zatrzymywanie lokalnych procesów React/Python (jeśli istnieją)...${NC}"
pkill -f "react-scripts" 2>/dev/null && echo -e "${GREEN}✅ React zatrzymany${NC}" || echo -e "${YELLOW}⚠️  Brak procesów React do zatrzymania${NC}"
pkill -f "start_enhanced_backend.py" 2>/dev/null || true
pkill -f "python.*backend" 2>/dev/null && echo -e "${GREEN}✅ Backend (lokalny) zatrzymany${NC}" || echo -e "${YELLOW}⚠️  Brak lokalnych procesów backend do zatrzymania${NC}"

# Zwolnienie typowych portów, jeśli są zajęte
for port in 3000 5001 5002; do
	if lsof -ti:$port >/dev/null 2>&1; then
		lsof -ti:$port | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port $port zwolniony${NC}"
	else
		echo -e "${YELLOW}⚠️  Port $port był wolny${NC}"
	fi
done

echo -e "${GREEN}✅ Wszystkie serwery zatrzymane / zasoby posprzątane${NC}"