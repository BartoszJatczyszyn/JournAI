# JournAI — uruchomienie w 1 min (Docker Compose)

Ten projekt zawiera backend analityczny (Flask) oraz bazę danych Postgres dla danych Garmin. Poniżej znajdziesz najprostszy możliwy sposób uruchomienia całości przy użyciu Docker Compose.

## Co uruchamia Compose
- db (Postgres 16, wolumen pg_data)
- backend (Enhanced Analytics API na porcie 5002)

Uwaga: Frontend (React) nie jest częścią docker-compose w tej wersji. Możesz korzystać bezpośrednio z API.

## Wymagania
- Docker Desktop (lub Docker + Compose v2)

## Szybki start (3 kroki)

1) (Opcjonalnie) skonfiguruj środowisko przez .env
```bash
cd AI
cp .env.docker.example .env  # jeśli chcesz nadpisać domyślne porty/zmienne
```

2) Uruchom stack
```bash
docker compose up -d --build
```

3) Sprawdź działanie backendu
```bash
# statystyki / status
curl http://localhost:5002/api/stats

# przykładowe zapytanie analityczne (skrócone wyjście)
curl "http://localhost:5002/api/analytics/enhanced/correlations?days=30" | head
```

## Zatrzymanie
```bash
docker compose down
# lub całkowicie z usunięciem wolumenów (utracisz dane bazy)
# docker compose down -v
```

## Ścieżki i wolumeny
- Postgres: dane w wolumenie `pg_data` (utrzymywane między restartami)
- Modele ML: montowane z hosta `./Diary-AI-BE/scripts/analytics/models` → `/app/scripts/analytics/models`
  - Dzięki temu obraz jest lżejszy, a artefakty modeli przechowujesz lokalnie
- HealthData (opcjonalnie): montowane z hosta `../HealthData` → `/app/HealthData` (read-only)
  - Jeśli nie masz katalogu `HealthData`, usuń/zmień ten wolumen w `docker-compose.yml`

## Konfiguracja
Backend w kontenerze czyta zmienne z pliku `/app/config.env`.
Domyślnie montujemy `AI/Diary-AI-BE/config.env.example` jako `config.env` (read‑only). Zmodyfikuj ten plik lub podmień wolumen, jeśli chcesz użyć własnych poświadczeń.

Najważniejsze zmienne (zazwyczaj wystarczą domyślne):
- DB_HOST=db
- DB_PORT=5432
- DB_NAME=diary
- DB_USER=diary_user
- DB_PASSWORD=diary123

Możesz także użyć `.env` przy Compose, aby nadpisać wartości (np. porty).

## Co jest w środku (skrót)
- `Diary-AI-BE/` — backend (Flask + analiza), uruchamiany jako `/app` w kontenerze
- `docker-compose.yml` — definicja usług (db + backend)
- `DOCKER_SETUP.md` — dodatkowe szczegóły (opcjonalne)
- `enhanced_migration.py` — jedyny kanoniczny skrypt migracji (poza Compose)

## Jak dołączyć frontend (lokalnie)

Frontend nie jest częścią docker-compose. Możesz uruchomić go lokalnie w drugim terminalu:

```bash
cd AI/Diary-AI-FE/frontend-react
npm install
npm start
```

- Aplikacja wystartuje na http://localhost:3000
- Proxy w package.json kieruje zapytania API do http://localhost:5002
- Opcjonalnie możesz wymusić adres backendu:
```bash
REACT_APP_API_URL=http://localhost:5002 npm start
```

## Najczęstsze problemy
- Port 5002 zajęty: Zmień mapowanie w `docker-compose.yml` lub w `.env`
- Backend nie wstaje (baza): Poczekaj, aż Postgres będzie healthy (sprawdź `docker compose ps`) i zajrzyj do `docker compose logs -f backend`
- Brak danych: jeśli chcesz, zamontuj katalog `HealthData` i uruchom migrację ręcznie (poza Compose)
