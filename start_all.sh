#!/bin/bash
set -euo pipefail

# start_all.sh — uruchomienie usług przy pomocy Docker Compose
# Domyślnie: uruchamia stack z `docker compose up -d --build` i czeka na backend.
# Opcjonalnie: przekazując flagę --with-frontend skrypt uruchomi lokalny dev server React

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

WITH_FRONTEND=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --with-frontend) WITH_FRONTEND=1; shift ;;
        --help|-h) echo "Usage: $0 [--with-frontend]"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}🔧 Uruchamianie usług przez Docker Compose...${NC}"

# Preferuj `docker compose` (compose v2). Jeśli nie ma — spróbuj `docker-compose`.
if command -v docker &>/dev/null; then
    DOCKER_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD="docker-compose"
else
    echo -e "${RED}❌ Nie znaleziono docker ani docker-compose. Zainstaluj Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Używam: $DOCKER_CMD${NC}"

echo -e "${BLUE}� Budowanie i uruchamianie usług (detached)...${NC}"
($DOCKER_CMD up -d --build) || { echo -e "${RED}❌ Błąd podczas uruchamiania docker compose${NC}"; exit 1; }

# Czekaj na backend (endpoint health)
echo -e "${YELLOW}⏳ Czekam na dostępność backendu na http://localhost:5002/api/stats ...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:5002/api/stats >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend gotowy na http://localhost:5002${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        echo -e "${RED}❌ Backend nie odpowiedział w ciągu 60s. Sprawdź logi kontenera: $DOCKER_CMD logs <backend>${NC}"
        exit 1
    fi
done

if [ "$WITH_FRONTEND" -eq 1 ]; then
    echo -e "${BLUE}🚀 Uruchamiam lokalny dev server React (opcjonalnie)...${NC}"
    FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
    cd "$FE_DIR"
    # wybierz pierwszy wolny port 3000-3010
    for p in {3000..3010}; do
        if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null; then
            FRONTEND_PORT=$p
            break
        fi
    done
    echo -e "${GREEN}🌐 Frontend będzie dostępny: http://localhost:${FRONTEND_PORT}${NC}"
    if [ ! -d node_modules ]; then
        echo -e "${BLUE}📦 Instaluję zależności frontendu...${NC}"
        npm install
    fi
    echo -e "${YELLOW}ℹ️  Aby zatrzymać frontend naciśnij Ctrl+C${NC}"
    trap 'echo -e "${YELLOW}\n🛑 Zatrzymywanie lokalnego frontendu...${NC}"; pkill -f "react-scripts" || true; exit 0' SIGINT SIGTERM
    PORT=$FRONTEND_PORT npm start
else
    echo -e "${GREEN}✅ Usługi uruchomione przez Docker Compose. Backend powinien być dostępny na http://localhost:5002${NC}"
    echo -e "${YELLOW}ℹ️  Jeśli chcesz także lokalny frontend, uruchom: ./start_all.sh --with-frontend${NC}"
fi