#!/bin/bash
set -euo pipefail

# 🏥 Garmin Health Dashboard - Uruchomienie Całego Projektu (Enhanced Backend + Frontend)
# Uczyń ścieżki względne niezależne od miejsca wywołania
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🏥 Garmin Health Dashboard"
echo "=========================="

# Kolory dla lepszej czytelności
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcja sprawdzania czy port jest wolny
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 1
    else
        return 0
    fi
}

# Sprawdź wymagania
echo -e "${BLUE}🔍 Sprawdzanie wymagań...${NC}"

# Sprawdź Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 nie jest zainstalowany${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python3: $(python3 --version)${NC}"

# Sprawdź Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js nie jest zainstalowany${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

# Sprawdź npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm nie jest zainstalowany${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Ścieżki projektów (BE/FE)
BE_DIR="$SCRIPT_DIR/Diary-AI-BE"
FE_DIR="$SCRIPT_DIR/Diary-AI-FE"

# Sprawdź porty i przygotuj środowisko
# Wczytaj zmienne środowiskowe, jeśli istnieją (np. DB, REACT_APP_API_URL)
if [ -f "$BE_DIR/config.env" ]; then
  export $(grep -v '^#' "$BE_DIR/config.env" | xargs -I{} echo {}) || true
fi

# Jeśli frontend ma wskazywać na inny backend, pozwól to nadpisać przez REACT_APP_API_URL
# Domyślnie frontend użyje proxy z package.json -> http://localhost:5002

# Sprawdź porty
echo -e "${BLUE}🔍 Sprawdzanie portów...${NC}"

if ! check_port 5002; then
    echo -e "${YELLOW}⚠️  Port 5002 jest zajęty - zatrzymuję proces...${NC}"
    pkill -f "python.*backend" || true
    sleep 2
fi

# Ustal pierwszy wolny port dla frontendu (3000-3010)
FRONTEND_PORT=3000
for p in {3000..3010}; do
    if check_port $p; then
        FRONTEND_PORT=$p
        break
    fi
    echo -e "${YELLOW}⚠️  Port $p jest zajęty - sprawdzam kolejny...${NC}"
done

if ! check_port $FRONTEND_PORT; then
    echo -e "${RED}❌ Brak wolnych portów dla frontendu w zakresie 3000-3010${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Wybrany port dla frontendu: $FRONTEND_PORT${NC}"

# Uruchom Backend (Enhanced)
# Najnowszy backend_enhanced startowany przez scripts/start_enhanced_backend.py
echo -e "${BLUE}🚀 Uruchamianie Enhanced Backend API...${NC}"
cd "$BE_DIR/scripts"

# Zainstaluj zależności backendu z głównego pliku (AI/requirements.txt)
echo -e "${BLUE}📦 Instalowanie zależności Python...${NC}"
python3 -m pip install -r "$BE_DIR/requirements.txt" --quiet || true

# Uruchomienia z auto-sprawdzeniem zależności i bazy w skrypcie
echo -e "${BLUE}🔥 Startowanie enhanced backend serwera...${NC}"
python3 start_enhanced_backend.py > "$BE_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Czekaj na uruchomienie backendu
echo -e "${YELLOW}⏳ Czekam na uruchomienie backendu...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5002/api/stats > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend uruchomiony na http://localhost:5002${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend nie uruchomił się w czasie 30 sekund${NC}"
        echo -e "${YELLOW}💡 Sprawdź logi: tail -f $BE_DIR/backend.log${NC}"
        exit 1
    fi
done

# Przejdź do katalogu React (frontend)
cd "$FE_DIR/frontend-react"
# Sprawdź czy node_modules istnieją
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Instalowanie zależności React...${NC}"
    npm install
fi

# Uruchom React
echo -e "${BLUE}🚀 Uruchamianie React Frontend...${NC}"
echo -e "${GREEN}🌐 Frontend będzie dostępny na: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${GREEN}🔗 Backend API (Enhanced) dostępne na: http://localhost:5002${NC}"
if [ -n "${REACT_APP_API_URL:-}" ]; then
  echo -e "${YELLOW}ℹ️  Frontend będzie korzystał z REACT_APP_API_URL=${REACT_APP_API_URL}${NC}"
else
  echo -e "${YELLOW}ℹ️  Frontend użyje proxy z package.json -> http://localhost:5002${NC}"
fi
echo -e "${YELLOW}💡 Aby zatrzymać serwery, naciśnij Ctrl+C${NC}"

# Funkcja czyszczenia przy wyjściu
cleanup() {
    echo -e "\n${YELLOW}🛑 Zatrzymywanie serwerów...${NC}"
    if kill -0 $BACKEND_PID 2>/dev/null; then
      kill $BACKEND_PID 2>/dev/null || true
    fi
    pkill -f "start_enhanced_backend.py" || true
    echo -e "${GREEN}✅ Serwery zatrzymane${NC}"
    exit 0
}

# Przechwytuj sygnały wyjścia
trap cleanup SIGINT SIGTERM

# Uruchom React (w foreground)
if [ -n "${REACT_APP_API_URL:-}" ]; then
  echo -e "${BLUE}🌐 Ustawiam REACT_APP_API_URL=${REACT_APP_API_URL}${NC}"
  REACT_APP_API_URL="$REACT_APP_API_URL" PORT=$FRONTEND_PORT npm start
else
  PORT=$FRONTEND_PORT npm start
fi

# Jeśli React się zakończy, zatrzymaj backend
cleanup