# 📥 Ręczna migracja danych Garmin do PostgreSQL (Projekt AI)

Poniższa instrukcja pokazuje jak samodzielnie załadować nowe dane z folderu `HealthData` do bazy PostgreSQL i zweryfikować wynik.

## Wymagania
- Python 3.10+
- PostgreSQL działający lokalnie (lub zdalnie) i dostępny po danych z `AI/config.env`
- Zainstalowane zależności Pythona: `pip install -r AI/requirements.txt`
- Folder `HealthData` w katalogu głównym repozytorium (lub ścieżka ustawiona przez `HEALTH_DATA_PATH`)

## Konfiguracja
1. Upewnij się, że istnieje plik `AI/config.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=diary
   DB_USER=diary_user
   DB_PASSWORD=diary123
   HEALTH_DATA_PATH=../HealthData
   ```
2. Jeśli Twój folder z danymi jest w innym miejscu, ustaw `HEALTH_DATA_PATH` na właściwą ścieżkę (może być bezwzględna).

## Szybki start migracji
1. Zainstaluj zależności (jednorazowo):
   ```bash
   cd AI
   pip install -r requirements.txt
   ```
2. Wykonaj szybki setup i testy połączenia + weryfikację ścieżek danych:
   ```bash
   python setup_migration.py
   ```
3. Uruchom pełną migrację (bezpieczny, ulepszony skrypt):
   ```bash
   python enhanced_migration.py
   ```
   Skrypt:
   - tworzy/aktualizuje tabele (BIGINT dla identyfikatorów snu i aktywności),
   - migruje:
     - Sleep (JSON w HealthData/Sleep)
     - RHR (JSON w HealthData/RHR)
     - Daily Summary (z SQLite: HealthData/DBs/garmin.db)
     - Heart Rate i Respiratory Rate (z SQLite: garmin_monitoring.db)
     - Activities (z SQLite: garmin_activities.db)
   - pomija wadliwe rekordy i kontynuuje migrację, logując szczegóły do `AI/migration.log`.

## Weryfikacja wyników
- Prosty test połączenia i struktury:
  ```bash
  python direct_db_check.py
  ```
- Weryfikacja aktywności vs źródło (SQLite):
  ```bash
  python verify_migration.py
  ```
- Dodatkowy szybki test:
  ```bash
  python simple_db_test.py
  ```

## Typowe problemy i naprawy
- Błąd zakresu integer przy śnie (sleep_id za duży):
  - Zastosowane w kodzie: typ BIGINT i bezpieczne konwersje — uruchom ponownie `enhanced_migration.py`.
  - Alternatywnie użyj instrukcji z `SLEEP_MIGRATION_FIX.md`.

- Brak folderu HealthData:
  - Ustaw poprawnie `HEALTH_DATA_PATH` w `AI/config.env` i/lub przesuń folder do katalogu repo.

- Brak połączenia z DB:
  - Zweryfikuj dane w `AI/config.env` i uruchom lokalnie Postgresa (lub docker-compose z `AI/docker-compose.yml`).

## Uruchomienie z Docker Compose (opcjonalnie)
Jeśli chcesz mieć gotowy Postgres i backend:
```bash
cd AI
cp .env.docker.example .env  # opcjonalnie, jeśli chcesz nadpisać porty
docker compose up -d --build
# (Po starcie) wejdź do kontenera backend i uruchom migrację (jeśli chcesz):
docker compose exec backend python run_migration.py
```

## Zaawansowane: selektywne migracje
Możesz odpalić tylko wybrane części migracji, modyfikując sekcję `main()` w `enhanced_migration.py` lub użyć poniższych fragmentów w Pythonie:
```python
from enhanced_migration import EnhancedGarminMigrator
m = EnhancedGarminMigrator()
# Wybierz co chcesz migrować
m.migrate_sleep_data()
m.migrate_rhr_data()
m.migrate_daily_summary_data()
m.migrate_heart_rate_data()
m.migrate_respiratory_rate_data()
m.migrate_activities_data()
```

## Gdzie są logi?
- `AI/migration.log` — szczegóły każdego kroku migracji i błędów danych.

---
Aktualizacja: 2025-09-29
