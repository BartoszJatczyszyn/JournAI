#!/bin/bash

# 🛑 Zatrzymanie wszystkich serwerów Garmin Health Dashboard

echo "🛑 Zatrzymywanie Garmin Health Dashboard..."

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Zatrzymaj procesy Python backend
echo -e "${YELLOW}🔍 Zatrzymywanie backend Python...${NC}"
pkill -f "start_enhanced_backend.py" 2>/dev/null || true
pkill -f "python.*backend" && echo -e "${GREEN}✅ Backend zatrzymany${NC}" || echo -e "${YELLOW}⚠️  Brak procesów backend do zatrzymania${NC}"

# Zatrzymaj procesy React
echo -e "${YELLOW}🔍 Zatrzymywanie React frontend...${NC}"
pkill -f "react-scripts" && echo -e "${GREEN}✅ React zatrzymany${NC}" || echo -e "${YELLOW}⚠️  Brak procesów React do zatrzymania${NC}"

# Zatrzymaj procesy Node.js na porcie 3000
echo -e "${YELLOW}🔍 Zatrzymywanie procesów na porcie 3000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 3000 zwolniony${NC}" || echo -e "${YELLOW}⚠️  Port 3000 był wolny${NC}"

# Zatrzymaj procesy na porcie 5001
echo -e "${YELLOW}🔍 Zatrzymywanie procesów na porcie 5001...${NC}"
lsof -ti:5001 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 5001 zwolniony${NC}" || echo -e "${YELLOW}⚠️  Port 5001 był wolny${NC}"

# Zatrzymaj procesy na porcie 5002 (Enhanced Backend)
echo -e "${YELLOW}🔍 Zatrzymywanie procesów na porcie 5002...${NC}"
lsof -ti:5002 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 5002 zwolniony${NC}" || echo -e "${YELLOW}⚠️  Port 5002 był wolny${NC}"

echo -e "${GREEN}✅ Wszystkie serwery zatrzymane${NC}"