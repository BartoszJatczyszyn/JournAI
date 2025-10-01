# JournAI — uruchomienie w 1 min (Docker Compose)

Ten projekt zawiera backend analityczny (Flask) oraz bazę danych Postgres dla danych Garmin. Poniżej znajdziesz najprostszy możliwy sposób uruchomienia całości przy użyciu Docker Compose.

## Co uruchamia Compose
- db (Postgres 16, wolumen pg_data)
- backend (Enhanced Analytics API na porcie 5002)

Uwaga: Frontend (React) nie jest częścią docker-compose w tej wersji. Możesz korzystać bezpośrednio z API.

## Wymagania
- Docker Desktop (lub Docker + Compose v2)

# JournAI — przegląd projektu i szybkie uruchomienie

To repozytorium zawiera backend analityczny (Flask), skrypty migracyjne oraz prosty frontend React przeznaczony do lokalnego testowania i wizualizacji wyników analizy danych Garmin/HealthData.

W tej wersji preferujemy uruchamianie usług przez Docker Compose. Skrypty `start_all.sh` i `stop_all.sh` zostały zaktualizowane tak, by domyślnie korzystać z dockera — lokalne uruchomienie frontendu pozostaje opcjonalne.

## Co robi projekt
- Agreguje i analizuje dane zdrowotne w Postgresie.
- Udostępnia API analityczne (Enhanced Analytics API, domyślnie na porcie 5002).
- Zawiera narzędzia do migracji/importu danych oraz prosty frontend React do podglądu wyników.

## Główne katalogi
- `Diary-AI-BE/` — backend (Flask, migracje, skrypty)
- `Diary-AI-FE/frontend-react/` — frontend React (dev server)
- `docker-compose.yml` — konfiguracja Postgres + backend (używane przez Docker Compose)

## Wymagania
- Docker z Compose (zalecane)
- Python 3 (jeśli uruchamiasz lokalnie)
- Node.js + npm (jeśli uruchamiasz frontend lokalnie)

## Szybkie uruchomienie (zalecane — Docker Compose)

1) Przejdź do katalogu projektu:

```bash
cd /path/to/AI
```

2) Uruchom stack przez Docker Compose (domyślnie uruchamia bazę i backend):

```bash
docker compose up -d --build
```

3) Sprawdź, czy backend odpowiada:

```bash
curl http://localhost:5002/api/stats
```

4) Zatrzymanie wszystkich kontenerów:

```bash
docker compose down
```

## `start_all.sh` — docker-first, z opcją lokalnego frontendu

Nowy `start_all.sh` działa tak:
- Domyślnie: używa `docker compose up -d --build` (lub `docker-compose` jeśli starsza wersja jest dostępna) i czeka, aż backend odpowie na `/api/stats`.
- Opcjonalnie: możesz dodać flagę `--with-frontend` aby uruchomić także lokalny dev server React (skrypt zainstaluje zależności i uruchomi `npm start` na pierwszym wolnym porcie z zakresu 3000-3010).

Przykłady:

Uruchom tylko docker stack (domyślnie):

```bash
./start_all.sh
```

Uruchom docker stack i lokalny frontend:

```bash
./start_all.sh --with-frontend
```

Uwaga: `--with-frontend` jest wygodne podczas developmentu (możesz wtedy korzystać z hot-reload w React), natomiast produkcyjny/deployowany frontend można serwować inaczej.

## `stop_all.sh` — zatrzymanie i czyszczenie

Nowy `stop_all.sh` robi dwie rzeczy:
- Próbuje zatrzymać stack przez `docker compose down` (lub `docker-compose down`).
- Dodatkowo czyści lokalne procesy, takie jak `react-scripts` czy lokalny backend uruchomiony skryptem `start_enhanced_backend.py`, oraz zwalnia typowe porty (3000, 5001, 5002) jeśli są zajęte.

Uruchom:

```bash
./stop_all.sh
```

Uwaga: skrypt używa `kill -9` do zwalniania portów — to szybkie rozwiązanie podczas developmentu, ale ostrożnie, jeśli na tych portach masz inne usługi.

## Jak sprawdzić, że wszystko działa
- Health endpoint:

```bash
curl http://localhost:5002/api/stats
```

- Przykładowy endpoint analityczny:

```bash
curl "http://localhost:5002/api/analytics/enhanced/correlations?days=30"
```

- Frontend (jeśli uruchomiony lokalnie): otwórz adres pokazany przez `start_all.sh` (np. http://localhost:3000).

## Logi i debug
- Kontener backendu: użyj `docker compose logs backend` lub `docker compose logs -f backend`.
- Lokalny backend (jeśli uruchamiasz bez dockera): sprawdź `Diary-AI-BE/backend.log`.

## Najczęstsze problemy
- Port 5002 zajęty — sprawdź, co nasłuchuje na tym porcie i zatrzymaj je, lub użyj innej konfiguracji.
- Docker nie zainstalowany — jeśli chcesz uruchamiać lokalnie, użyj `./start_all.sh --with-frontend` i upewnij się, że masz Python/Node/npm.
- Frontend nie startuje — usuń `node_modules` i spróbuj `npm install` ręcznie.

## Migracje i import danych
- Skrypty migracyjne i importujące dane znajdują się w `Diary-AI-BE/scripts/` oraz w plikach w katalogu głównym (np. `enhanced_migration.py`). Zajrzyj też do `docs/` i `archive/` dla dodatkowych instrukcji.

---

Jeśli chcesz, mogę:
- dodać przykładowe cURL-e z odpowiedziami; lub
- rozbudować sekcję development o instrukcję tworzenia venv i instalacji zależności backendu bez dockera.

Napisz, co wolisz, to dopracuję README dalej.

