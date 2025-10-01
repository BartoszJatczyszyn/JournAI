# Docker Setup (Backend + Postgres)

## Overview
This setup lets anyone start the Postgres database and the enhanced backend API (`Port 5002`) with a single command using `docker-compose`.

## Files
- `docker-compose.yml` – Services: `db` (Postgres 16), `backend` (Flask AI analytics)
- `Diary-AI-BE/Dockerfile` – Backend image (Python 3.13 slim)
- `.env.docker.example` – Example root-level env file for overrides
- `DOCKER_SETUP.md` – This guide

## Quick Start
```bash
# 1. (Opcjonalnie) utwórz plik .env na podstawie przykładu
cp .env.docker.example .env

# 2. Uruchom stack
docker compose up -d --build

# 3. Sprawdź status
docker compose ps

# 4. Logi backendu
docker compose logs -f backend

# 5. Test endpointu zdrowia / przykładowy
curl http://localhost:5002/api/analytics/enhanced/correlations?days=30 | head
```

## Zatrzymanie i usuwanie
```bash
docker compose down  # zatrzymanie
# lub z usunięciem wolumenów (kopia bazy zostanie utracona)
docker compose down -v
```

## Dane trwałe
- Wolumen `pg_data` przechowuje dane Postgresa między restartami.
- Modele ML (`*.joblib`) montowane z hosta: `./Diary-AI-BE/scripts/analytics/models` -> `/app/scripts/analytics/models`.
  - Dzięki temu modele nie są budowane w obrazie (zmniejszony rozmiar), a ich stan utrzymujesz na hoście.

## Zmiana portów
W pliku `.env` możesz ustawić:
```
HOST_PORT_BACKEND=5005
HOST_PORT_POSTGRES=5433
```
Następnie dopasuj mapowania portów w `docker-compose.yml` (lub rozszerz plik przez `docker-compose.override.yml`).

## Migrations (Jeśli dodasz w przyszłości)
Aktualne skrypty `run_migration.py` / `setup_migration.py` są już w obrazie. Możesz ręcznie wykonać:
```bash
docker compose exec backend python run_migration.py
```
(Obecnie backend startuje bez obowiązkowego kroku migracji – dane powinny być już w bazie lub możesz załadować je osobno.)

## Przebudowa po zmianach kodu
Jeśli zmienisz kod w `Diary-AI-BE/scripts`, przebuduj obraz:
```bash
docker compose build backend
# lub z wymuszeniem bez cache
docker compose build --no-cache backend
```

## Entry point (zmiana)
Obraz backendu uruchamia teraz bezpośrednio moduł:
```
ENTRYPOINT ["python", "-m", "scripts.start_enhanced_backend"]
```
Wcześniej kopiowaliśmy skrypt do katalogu głównego obrazu i uruchamialiśmy `python start_enhanced_backend.py`. Ta zmiana upraszcza obraz i zmniejsza liczbę kopiowanych plików.

## Debug / Interactive
```bash
docker compose exec backend bash  # jeśli chcesz mieć powłokę (dodaj pakiet bash jeśli potrzebny)
```

## Potencjalne rozszerzenia
- Dodanie usługi PgAdmin
- Dodanie kontenera frontend (nginx + build React)
- Healthcheck backendu (endpoint /api/health jeśli dodasz)
- Automatyczne uruchomienie skryptów ETL / backfill w entrypoint

## Troubleshooting
| Problem | Rozwiązanie |
|---------|-------------|
| Backend nie startuje, błąd połączenia z DB | Upewnij się, że `db` ma status healthy (sprawdź `docker compose ps`). |
| Port 5002 zajęty | Zmień `HOST_PORT_BACKEND` lub mapowanie w compose. |
| Modele się nie zapisują | Sprawdź uprawnienia katalogu `Diary-AI-BE/scripts/models`. |
| Brak danych w zapytaniach analitycznych | Upewnij się, że baza zawiera dane – w razie potrzeby załaduj je skryptem migracyjnym. |

## Minimalny przepływ testowy
```bash
curl http://localhost:5002/api/predictions/energy?days_ahead=3
curl http://localhost:5002/api/analytics/enhanced/comprehensive?days=30 | jq '.analysis_type'
```

---
Ostatnia aktualizacja: 2025-09-27
