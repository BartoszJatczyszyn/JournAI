#!/bin/bash
# full_reset.sh — pełne wyczyszczenie bazy (usunięcie wolumenu), przebudowa obrazów,
# start Postgresa + backendu i wykonanie migracji, a następnie (opcjonalnie) start frontendu lokalnie.
# Użycie:
#   ./full_reset.sh            # reset + migracja + backend
#   ./full_reset.sh --with-frontend  # dodatkowo uruchomi frontend React lokalnie
#   ./full_reset.sh --no-cache       # wymusi build bez cache
#   Można łączyć: ./full_reset.sh --no-cache --with-frontend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WITH_FRONTEND=0
NO_CACHE=0
RUN_GARMINDb=1  # można wyłączyć przez --skip-garmindb

for arg in "$@"; do
  case "$arg" in
    --with-frontend) WITH_FRONTEND=1 ; shift ;;
  --no-cache) NO_CACHE=1 ; shift ;;
  --skip-garmindb) RUN_GARMINDb=0 ; shift ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Nieznana opcja: $arg" ; exit 1 ;;
  esac
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# (0) Opcjonalnie: pobierz/odśwież dane Garmin przez garmindb_cli.py
# ---------------------------------------------------------------
# Użytkownik poprosił, aby przed resetem uruchamiać:
#   garmindb_cli.py --all --download --import --analyze --latest
# Założenia:
#   - Skrypt może znajdować się w: 
#       ./garmindb_cli.py lub Diary-AI-BE/scripts/cli/garmindb_cli.py
#   - Jeśli nie istnieje, wypisujemy ostrzeżenie i kontynuujemy.
#   - Można pominąć przez flagę: --skip-garmindb

if [ $RUN_GARMINDb -eq 1 ]; then
  echo -e "${BLUE}📥 Wykonuję wstępny etap: garmindb (download/import/analyze/latest) – pomijam szukanie lokalnego pliku, używam globalnych poleceń...${NC}"

  # Funkcja pomocnicza: znajdź python z importem garmindb
  find_python_with_garmindb() {
    local candidates
    candidates=("${SCRIPT_DIR}/.venv/bin/python" "python3" "python")
    for py in "${candidates[@]}"; do
      if command -v "$py" >/dev/null 2>&1; then
        if "$py" -c 'import garmindb' >/dev/null 2>&1; then
          echo "$py"; return 0
        fi
      fi
    done
    return 1
  }

  GCLI_STATUS=0
  if command -v garmindb_cli.py >/dev/null 2>&1; then
    echo -e "${BLUE}▶️  garmindb_cli.py --all --download --import --analyze --latest${NC}"
    set +e; garmindb_cli.py --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
  elif command -v garmindb >/dev/null 2>&1; then
    echo -e "${BLUE}▶️  garmindb --all --download --import --analyze --latest${NC}"
    set +e; garmindb --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
  else
    PY_CMD="$(find_python_with_garmindb || echo '')"
    if [ -n "$PY_CMD" ]; then
      echo -e "${BLUE}▶️  $PY_CMD -m garmindb --all --download --import --analyze --latest${NC}"
      set +e; "$PY_CMD" -m garmindb --all --download --import --analyze --latest; GCLI_STATUS=$?; set -e
    else
      echo -e "${YELLOW}⚠️  Nie znaleziono globalnego polecenia garmindb (pomijam etap). Zainstaluj: pip install garmindb lub użyj --skip-garmindb.${NC}"
      GCLI_STATUS=0
    fi
  fi

  if [ $GCLI_STATUS -ne 0 ]; then
    echo -e "${RED}⚠️  garmindb zakończył się kodem $GCLI_STATUS (kontynuuję reset bazy).${NC}"
  else
    echo -e "${GREEN}✅ garmindb etap zakończony (lub pominięty bez błędu)${NC}"
  fi
else
  echo -e "${YELLOW}⏭  Pomijam etap garmindb_cli.py (użyto --skip-garmindb)${NC}"
fi

# Wykryj docker compose
if command -v docker &>/dev/null; then
  DC='docker compose'
elif command -v docker-compose &>/dev/null; then
  DC='docker-compose'
else
  echo -e "${RED}❌ Brak polecenia docker / docker-compose${NC}"; exit 1
fi

# 1. Zatrzymaj i usuń stack + wolumeny
echo -e "${BLUE}🧹 Zatrzymuję kontenery i usuwam wolumeny (baza zostanie wyczyszczona)...${NC}"
$DC down -v || true

# 2. (Opcjonalnie) usuń dangling images
if docker images -f dangling=true -q | grep -q .; then
  echo -e "${YELLOW}🗑  Usuwam dangling images...${NC}"
  docker rmi $(docker images -f dangling=true -q) || true
fi

# 3. Build świeżych obrazów
echo -e "${BLUE}🏗  Buduję obrazy backendu...${NC}"
if [ $NO_CACHE -eq 1 ]; then
  $DC build --no-cache --pull
else
  $DC build --pull
fi

echo -e "${BLUE}🐘 Start samej bazy (db) aby móc wykonać migrację)...${NC}"
$DC up -d db

# 4. Czekaj aż Postgres zdrowy (healthcheck w compose)
echo -e "${YELLOW}⏳ Czekam na zdrowy Postgres...${NC}"
for i in {1..30}; do
  status=$(docker inspect -f '{{ .State.Health.Status }}' journal_ai_db 2>/dev/null || echo 'unknown')
  if [ "$status" = "healthy" ]; then
    echo -e "${GREEN}✅ Postgres gotowy${NC}"; break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Postgres nie osiągnął stanu healthy${NC}"; exit 1
  fi
done

# 5. Start backendu
echo -e "${BLUE}🚀 Start backendu...${NC}"
$DC up -d backend

# 6. Czekaj aż backend odpowie
BACKEND_URL="http://localhost:5002/api/stats"
echo -e "${YELLOW}⏳ Czekam na backend (${BACKEND_URL})...${NC}"
for i in {1..60}; do
  if curl -s "$BACKEND_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend działa${NC}"; break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo -e "${RED}❌ Backend nie odpowiedział w ciągu 60s${NC}"; exit 1
  fi
done

# 7. Uruchom migrację wewnątrz kontenera backendu
echo -e "${BLUE}📦 Uruchamiam migrację danych (run_migration.py)...${NC}"
set +e
docker exec journal_ai_backend python run_migration.py --subset all
MIG_STATUS=$?
set -e
if [ $MIG_STATUS -ne 0 ]; then
  echo -e "${RED}❌ Migracja zakończona błędem (kod $MIG_STATUS) — sprawdź logi: docker compose logs backend${NC}"
  exit $MIG_STATUS
fi

echo -e "${GREEN}✅ Migracja zakończona sukcesem${NC}"

# 8. (Opcjonalnie) start frontendu lokalnie
if [ $WITH_FRONTEND -eq 1 ]; then
  echo -e "${BLUE}🌐 Uruchamiam frontend React lokalnie...${NC}"
  FE_DIR="$SCRIPT_DIR/Diary-AI-FE/frontend-react"
  if [ ! -d "$FE_DIR" ]; then
    echo -e "${RED}❌ Katalog frontendu nie istnieje: $FE_DIR${NC}"; exit 1
  fi
  pushd "$FE_DIR" >/dev/null
  if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Instaluję zależności (npm install)...${NC}"
    npm install
  fi
  # znajdź wolny port
  for p in {3000..3010}; do
    if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null; then
      FRONTEND_PORT=$p; break
    fi
  done
  echo -e "${GREEN}🌍 Frontend wystartuje na http://localhost:${FRONTEND_PORT}${NC}"
  PORT=$FRONTEND_PORT npm start
  popd >/dev/null
else
  echo -e "${GREEN}🎉 Gotowe: Baza czysta, migracja wykonana, backend działa na http://localhost:5002${NC}"
  echo -e "${YELLOW}Aby odpalić frontend: ./full_reset.sh --with-frontend (lub ./start_all.sh --with-frontend)${NC}"
fi
