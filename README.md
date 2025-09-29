# 🏥 JournAI – Garmin Health Data Analysis System

"JournAI" to nowa nazwa repozytorium (wcześniej roboczo: Diary-AI / Journal-AI). Nazwy katalogów `Diary-AI-BE/` i `Diary-AI-FE/` pozostają tymczasowo niezmienione (stabilne ścieżki w skryptach). Przy ewentualnym ich refaktorze (np. na `journai-be/`, `journai-fe/`) należy zaktualizować: 
- odwołania w Dockerfile / docker-compose
- ścieżki w README / DOCKER_SETUP.md / QUICK_START.md
- reguły w `.gitignore`
- komendy w dokumentacji migracji

Jeśli chcesz już teraz zmienić remote po rename w GitHub: 
```
git remote set-url origin https://github.com/<twoj-user>/JournAI.git
```
albo przez SSH: 
```
git remote set-url origin git@github.com:<twoj-user>/JournAI.git
```

Kompletny system analizy danych zdrowotnych z urządzeń Garmin z integracją PostgreSQL, dziennikiem osobistym i zaawansowaną analityką AI.

## 📊 Funkcjonalności

### ✅ Kompletna migracja danych Garmin:
- **959,911 rekordów** zdrowotnych w 9 tabelach
- **305,354 pomiarów tętna** co minutę (24/7)
- **268,844 pomiarów częstości oddechowej**
- **380,672 pomiarów stresu**
- **1,025 aktywności sportowych** z pełnymi danymi
- **277 sesji snu** z detalową analizą

### 📝 Dziennik osobisty:
- **69 kolumn** do trackingu życia
- Nastrój, energia, stress (skale 1-5)
- Odżywianie, suplementy, nawyki
- Korelacje z danymi Garmin

### 🧠 **NOWE! Zaawansowana Analityka AI:**
- **Korelacje wielowymiarowe** (Pearson, Spearman, Kendall)
- **Analiza klastrów** - automatyczne wykrywanie wzorców zdrowotnych
- **Analiza temporalna** - wzorce tygodniowe i sezonowe
- **Analiza regeneracji** - kompleksowa ocena odzyskiwania sił
- **Analityka predykcyjna** - prognozy energii, snu i nastroju
- **Personalizowane rekomendacje** oparte na danych

### 🔬 Specjalistyczne moduły analityczne:
- **Analiza snu**: efektywność, timing, wpływ na wydajność
- **Analiza stresu**: wzorce godzinowe, triggery, regeneracja
- **Analiza aktywności**: intensywność, konsystencja, korelacje z regeneracją

### 🗃️ Zorganizowane tabele:
- `garmin_daily_summaries` - dzienne podsumowania (33 kolumny)
- `garmin_activities` - aktywności sportowe (51 kolumn)
- `garmin_sleep_sessions` - sesje snu (21 kolumn)
- `daily_journal` - dziennik osobisty (69 kolumn)

## 🚀 Szybki start

1. **Konfiguracja bazy:**
   ```bash
   # Edytuj config.env z danymi PostgreSQL
   cp config.env.example config.env
   ```

2. **Instalacja zależności:**
   ```bash
   pip install -r Diary-AI-BE/requirements.txt
   ```

3. **Uruchomienie backendu:**
   ```bash
   # NOWY! Enhanced Backend z AI Analytics
   python scripts/start_enhanced_backend.py
   
   # Lub bezpośrednio
   cd Diary-AI-BE/scripts && python backend_api_enhanced.py
   
   # Backend Enhanced (zalecany)
   python scripts/start_enhanced_backend.py
   ```

4. **Dashboard:**
   Otwórz `Diary-AI-FE/simple_dashboard.html` w przeglądarce

### � Skrypty start/stop (lokalne środowisko)
W katalogu głównym są dostępne uproszczone skrypty:

```bash
./start_all.sh   # uruchamia backend (enhanced) i ewentualne procesy pomocnicze
./stop_all.sh    # zatrzymuje procesy backendu (wyszukując działające PID)
```

Zastosowanie:
- Szybki restart podczas developmentu
- Pewność, że nie zostanie „wiszący” proces backendu rezerwujący port 5002

Jeśli skrypt nie ma uprawnień wykonywalnych:
```bash
chmod +x start_all.sh stop_all.sh
```

W środowisku Docker zamiast tego używaj `docker compose up` / `down`.

### �🐳 Alternatywa: uruchomienie przez Docker Compose

Najprostszy sposób aby każdy uruchomił backend + Postgres bez lokalnej instalacji zależności.

```bash
# Skopiuj zmienne (opcjonalnie)
cp .env.docker.example .env

# Uruchom stack (baza + backend)
docker compose up -d --build

# Sprawdź logi
docker compose logs -f backend

# Przetestuj endpoint
curl http://localhost:5002/api/predictions/energy?days_ahead=3
```

Szczegóły: zobacz `DOCKER_SETUP.md`.

#### Migrowanie danych do bazy w środowisku Docker

Jeśli chcesz wypełnić czystą bazę danymi Garmin/journal:

1. Upewnij się, że stack działa:
   ```bash
   docker compose up -d --build
   docker compose ps
   ```
2. Wejdź do kontenera backend lub uruchom komendę bezpośrednio:
   ```bash
   # Pełna migracja (wszystkie tabele / zakresy)
   docker compose exec backend python run_migration.py --subset all

   # Lub migracje częściowe (przykłady):
   docker compose exec backend python run_migration.py --subset daily
   docker compose exec backend python run_migration.py --subset sleep
   docker compose exec backend python run_migration.py --subset activities
   docker compose exec backend python run_migration.py --subset journal
   docker compose exec backend python run_migration.py --subset stats  # wyliczenia agregatów minutowych
   ```
3. Walidacja po migracji (przykładowe zapytania):
   ```bash
   docker compose exec db psql -U diary_user -d diary -c "SELECT COUNT(*) FROM garmin_daily_summaries;"
   docker compose exec db psql -U diary_user -d diary -c "SELECT COUNT(*) FROM garmin_sleep_sessions;"
   docker compose exec db psql -U diary_user -d diary -c "SELECT COUNT(*) FROM daily_journal;"
   ```
4. Test endpointów po migracji:
   ```bash
   curl 'http://localhost:5002/api/analytics/enhanced/correlations?days=30' | head
   curl 'http://localhost:5002/api/predictions/energy?days_ahead=3'
   ```

Bezpieczeństwo: plik `config.env` nie jest potrzebny wewnątrz kontenera (zmienne przekazuje compose). Jeśli dodasz własny config – nie commituj go do repo.

Przebudowa po zmianach migratora (`scripts/enhanced_migration.py`):
```bash
docker compose build backend
docker compose exec backend python run_migration.py --subset all
```

## 🆕 Enhanced Backend API - Zaawansowana Analityka

### 🧠 Zaawansowane endpointy analityczne:
- `/api/analytics/enhanced/comprehensive` - kompleksowa analiza AI
- `/api/analytics/enhanced/correlations` - korelacje wielowymiarowe
- `/api/analytics/enhanced/clusters` - analiza klastrów zdrowotnych
- `/api/analytics/enhanced/temporal-patterns` - wzorce temporalne
- `/api/analytics/enhanced/recovery` - analiza regeneracji

### 🔬 Specjalistyczne analizy:
- `/api/analytics/sleep/comprehensive` - kompleksowa analiza snu
- `/api/analytics/stress/comprehensive` - analiza wzorców stresu
- `/api/analytics/activity/comprehensive` - analiza aktywności

### 🔮 Analityka predykcyjna:
- `/api/predictions/energy` - prognozy poziomu energii
- `/api/predictions/sleep` - prognozy jakości snu
- `/api/predictions/mood` - prognozy nastroju
- `/api/predictions/comprehensive` - kompleksowe prognozy
- `/api/trends/health` - trendy zdrowotne

#### Parametry prognoz (days_ahead)
Każdy endpoint predykcyjny przyjmuje parametr zapytania `days_ahead` (alias: `days`) określający horyzont prognozy.

Rekomendowane wartości:
- 1–7 dni: najwyższa trafność (modele RandomForest + cechy krótkoterminowe)
- 8–14 dni: akceptowalne, ale malejąca pewność (confidence spada liniowo)
- >14 dni: możliwe, lecz mało wiarygodne (generowane wyłącznie ekstrapolacyjnie – niezalecane)

Każda pojedyncza prognoza zawiera:
```json
{
   "date": "2025-10-02",
   "predicted_value": 3.87,
   "confidence": 0.82
}
```
`confidence` maleje wraz z odległością dnia w horyzoncie oraz oceną jakości modelu (`confidence_level`: high / medium / low / very_low).

Fallback: Gdy zbyt mało danych (<30 pełnych rekordów) model przełącza się na tryb bazowy (trend + średnia z ostatnich wartości) i zwraca strukturę z `confidence_level = very_low`.

### 💡 Personalizowane insights:
- `/api/insights/personalized` - spersonalizowane rekomendacje
- `/api/insights/optimization` - optymalizacja metryk zdrowotnych
- `/api/analytics/compare/periods` - porównania okresów

### 🛠️ Endpoint administracyjny (operacje ML)
- `POST /api/admin/models/retrain`
   - Usuwa zapisane artefakty modeli (`energy.joblib`, `sleep.joblib`, `mood.joblib`)
   - Modele zostaną przebudowane leniwie przy następnym wywołaniu endpointu predykcyjnego
   - Opcjonalne body JSON do selektywnej kasacji:
      ```json
      { "models": ["energy", "sleep"] }
      ```
   - Przykład odpowiedzi:
      ```json
      {
         "status": "success",
         "removed": ["energy.joblib", "sleep.joblib"],
         "message": "Models deleted; they will be retrained on next prediction request."
      }
      ```

### 🔍 Ważne parametry zapytań (query params)
| Obszar | Parametr | Domyślna | Zakres / Uwagi |
|--------|----------|----------|----------------|
| Enhanced analytics | `days` | 90 | 1–365 |
| Clusters | `clusters` | 3 | 2–15 (większa liczba = większe ryzyko szumu) |
| Recovery | `compare` | false | `true` dodaje poprzedni okres trendu |
| Period compare | `period1_days`, `period2_days` | 30 | 1–365 |
| Period compare | `offset_days` | 30 | odstęp między okresami |
| Predictions | `days_ahead` (`days`) | 7 | rekomendowane 1–14 |
| Insights optimization | `metric` | sleep_quality | dowolna nazwa metryki w zbiorze |

### ♻️ Trwałość i retraining modeli
Modele ML są zapisywane jako pliki `.joblib` w `Diary-AI-BE/scripts/analytics/models/` i są ignorowane przez Git (`.gitignore`).

Strategia:
- Przy starcie: próba załadowania artefaktu; jeśli niezgodny – automatyczne usunięcie i retraining
- Przy błędzie ładowania (np. zmiana wersji scikit-learn): wymuszone kasowanie i ponowny trening
- Retraining następuje tylko jeśli model nie istnieje lub jest niekompatybilny (leniwe podejście)

Confidence logic:
- Globalna jakość modelu (`confidence_level`) oparta o R² (progi: 0.8 / 0.6 / 0.4)
- Per-dzień `confidence` maleje liniowo do min. 0.5 przy końcu horyzontu

### 🧪 Przykłady (curl)
```bash
# 3-dniowa prognoza energii
curl 'http://localhost:5002/api/predictions/energy?days_ahead=3'

# 14-dniowa prognoza snu (górna granica rekomendacji)
curl 'http://localhost:5002/api/predictions/sleep?days_ahead=14'

# Kompleksowe prognozy (mood + energy + sleep)
curl 'http://localhost:5002/api/predictions/comprehensive?days_ahead=7'

# Porównanie dwóch okresów (30 dni vs 30 dni z 30-dniowym offsetem)
curl 'http://localhost:5002/api/analytics/compare/periods?period1_days=30&period2_days=30&offset_days=30'

# Recovery z porównaniem poprzedniego okresu
curl 'http://localhost:5002/api/analytics/enhanced/recovery?days=90&compare=true'

# Kasacja artefaktów modeli (wymuszenie retrainingu)
curl -X POST 'http://localhost:5002/api/admin/models/retrain' \
       -H 'Content-Type: application/json' \
       -d '{"models": ["energy", "sleep"]}'
```

### 💓 Monitoring w czasie rzeczywistym:
- **305,354 pomiarów tętna** co minutę (24/7)
- **380,672 pomiarów stresu** z kategoryzacją
- **268,844 pomiarów częstości oddechowej**
- **3,362 zdarzeń snu** z detalową analizą
- **98 pomiarów wagi** z trendem

### 🔗 Standardowe endpointy API:
- `/api/heart-rate/daily/<date>` - dane tętna dla dnia
- `/api/stress/daily/<date>` - dane stresu z kategoryzacją
- `/api/respiratory-rate/daily/<date>` - częstość oddechowa
- `/api/weight/history` - historia wagi
- `/api/sleep/events/<date>` - zdarzenia podczas snu

  - `scripts/services/trends_service.py` – zapytania trendów (sen, waga, nastrój)

## \ud83d\ude80 Szybki start

Poni\u017cej znajdziesz najprostszy, przetestowany przep\u0142yw uruchomienia: backend (Postgres + Python API) w Dockerze oraz frontend lokalnie przez npm (u\u017cyteczne podczas developmentu).

1) Uruchom backend + baz\u0119 (Docker)

```bash
# (opcjonalnie) skopiuj przyk\u0142adowe zmienne do pliku .env
cp .env.docker.example .env || true

# Z katalogu root repo uruchom stack (Postgres + backend)
docker compose up -d --build

# Podgl\u0105d log\u00f3w backendu
docker compose logs -f backend
```

Backend domy\u015blnie nas\u0142uchuje na: http://localhost:5002

2) Uruchom frontend lokalnie (oddzielnie, npm)

```bash
# Przejd\u017a do folderu z frontendem React
cd Diary-AI-FE/frontend-react

# Zainstaluj zale\u017cno\u015bci (macOS / zsh)
npm install

# Uruchom frontend dev server
npm start
```

Frontend dev server uruchomi sie domy\u015blnie na: http://localhost:3000 i ma ustawiony "proxy" do backendu `http://localhost:5002` (zdefiniowane w `Diary-AI-FE/frontend-react/package.json`), dzi\u0119ki czemu wywo\u0142ania API z przegl\u0105darki b\u0119d\u0105 kierowane do lokalnego backendu.

3) Alternatywy

- Je\u015bli wolisz uruchomi\u0107 backend lokalnie bez Dockera:

```bash
cp config.env.example config.env
pip install -r Diary-AI-BE/requirements.txt
python scripts/start_enhanced_backend.py
```

- Je\u015bli chcesz serwowa\u0107 frontend statycznie w Dockerze, u\u017cyj skryptu `./start_fresh_docker.sh` (uruchomi tymczasowy nginx by podpi\u0107 zawarto\u015b\u0107 `Diary-AI-FE`), lub zbuduj frontend `npm run build` i zamontuj `build/` do kontenera nginx.

4) Testy zdrowia

```bash
# backend health
curl http://localhost:5002/api/health

# przyk\u0142adowy endpoint (analytics)
curl 'http://localhost:5002/api/predictions/energy?days_ahead=3'
```

Uwagi:
- Port backendu: 5002
- Port frontend dev servera: 3000
- Upewnij si\u0119, \u017ce masz Node.js w wersji zgodnej z `Diary-AI-FE/frontend-react/package.json` (zalecane: Node >=18.18.0 lub >=20)

### Skrypty start/stop (lokalne)
W katalogu g\u0142\u00f3wnym s\u0105 dost\u0119pne uproszczone skrypty:

```bash
./start_all.sh   # uruchamia backend (enhanced) i ewentualne procesy pomocnicze
./stop_all.sh    # zatrzymuje procesy backendu (wariant lokalny)
```

Je\u015bli skrypt nie ma uprawnie\u0144 wykonywalnych:

```bash
chmod +x start_all.sh stop_all.sh
```
✅ **KOMPLETNY SYSTEM Z AI ANALYTICS GOTOWY DO UŻYCIA**
- Wszystkie dane Garmin zmigrowane
- Tabele zoptymalizowane i zorganizowane
- Dziennik osobisty zintegrowany
- API i dashboard działają
- **NOWE!** Zaawansowana analityka AI z machine learning
- **NOWE!** Analityka predykcyjna i personalizowane rekomendacje
- **NOWE!** Specjalistyczne moduły analityczne
- Gotowy do zaawansowanych analiz zdrowotnych

## 🔐 Bezpieczeństwo i publikacja na GitHub

Przed publikacją upewnij się że:
- NIE commitujesz pliku `config.env` (użyj `config.env.example` jako szablonu)
- Modele i cache nie zawierają danych prywatnych
- Lokalna ścieżka `HEALTH_DATA_PATH` nie wskazuje na prywatny katalog w repo

## 🧩 Migracja nowych danych (skrót)

Szczegółowa instrukcja: patrz AI/docs/MANUAL_MIGRATION.md

Najkrótsza ścieżka (Docker):
```bash
cd AI
docker compose up -d --build
# Zamontowałem już lokalny HealthData do kontenera backend w docker-compose.yml
# Uruchom pełną migrację:
docker compose exec backend python - <<'PY'
from enhanced_migration import EnhancedGarminMigrator
m=EnhancedGarminMigrator()
m.migrate_sleep_data(); m.migrate_rhr_data(); m.migrate_daily_summary_data(); m.migrate_heart_rate_data(); m.migrate_respiratory_rate_data(); m.migrate_activities_data()
print('✅ Migracja zakończona')
PY
# lub:
# docker compose exec backend python run_migration.py
```

Wyniki sprawdzisz m.in. tak:
```bash
docker compose exec db psql -U diary_user -d diary -c "SELECT COUNT(*) FROM garmin_sleep_sessions;"
docker compose exec db psql -U diary_user -d diary -c "SELECT COUNT(*) FROM garmin_activities;"
```

Jeśli nie chcesz Dockera:
```bash
cd AI
pip install -r requirements.txt
python setup_migration.py
python enhanced_migration.py
```

## 📂 Folder `HealthData` – co to jest i jak używać

`HealthData/` to **lokalny katalog źródłowy surowych danych Garmin** (eksport / zrzuty / pliki *.db / CSV), z którego migrator pobiera dane i ładuje je do PostgreSQL.

### Dlaczego nie ma go w repo?
- Zawiera dane wrażliwe / prywatne (tętno, sen, stres, nawyki)
- Pliki binarne i bazy SQLite powiększyłyby repo i utrudniły historię
- Dane źródłowe powinny być odtwarzalne z prywatnego archiwum u użytkownika

### Jak wskazać ścieżkę?
Ustaw zmienną środowiskową (lub wpis w `config.env`):
```
HEALTH_DATA_PATH=/absolute/path/do/HealthData
```
Jeśli nie ustawisz – migrator spróbuje użyć lokalnie `./HealthData` (i zaloguje ostrzeżenie gdy nie istnieje).

### Struktura oczekiwana (przykład)
```
HealthData/
   Sleep/                    # Pliki snu / JSON / CSV
   RHR/                      # Resting Heart Rate
   Weight/                   # Historia wagi
   DBs/                      # Bazy SQLite (garmin.db, garmin_activities.db itd.)
   Activities/               # (opcjonalnie) pliki aktywności
   ...
```

### Jak sprawdzić czy ścieżka działa
```bash
python Diary-AI-BE/run_migration.py --subset sleep
```
Jeśli katalog błędny – zobaczysz ostrzeżenie o fallbacku lub brak rekordów w tabeli docelowej.

### W środowisku Docker
- Domyślnie kontener backend używa ścieżki wewnętrznej (jeśli chciałbyś użyć lokalnych surowych plików, zamontuj je):
```yaml
   backend:
      volumes:
         - /lokalna/sciezka/HealthData:/app/HealthData:ro
      environment:
         HEALTH_DATA_PATH=/app/HealthData
```

### Dobre praktyki
- Nigdy nie commituj prawdziwego `HealthData/`
- Jeśli chcesz udostępnić strukturę, zrób pusty przykład typu `HealthData.example/` (bez realnych danych)
- Regularnie archiwizuj źródło (zip + szyfrowanie) poza repo

### Szybka diagnostyka (skrypt własny)
Możesz stworzyć prosty checker (już masz `simple_check.py` / `test_fixed_migration.py`):
```bash
python simple_check.py
```
Jeśli wszystko ok – zobaczysz ✅ przy podkatalogach (Sleep, RHR, Weight ...)


### Kroki publikacji (jeśli tworzysz nowe repo)
```bash
git init
git add .
git commit -m "Initial project import"
git branch -M master
# utwórz repo na GitHub (lub użyj istniejącego) i dodaj remote:
git remote add origin https://github.com/<twoj-user>/JournAI.git
git push -u origin master
```

### Aktualizacja istniejącego repo
```bash
git pull --rebase origin master
# wprowadź zmiany
git add .
git commit -m "<opis zmian>"
git push
```

### Regeneracja środowiska po klonowaniu
```bash
cp config.env.example config.env
pip install -r Diary-AI-BE/requirements.txt
python scripts/start_enhanced_backend.py
```

> Jeśli przypadkowo wypchniesz sekrety: natychmiast je zmień, usuń z historii (`git filter-repo` / `git filter-branch`) i force push.

---
*Ostatnia aktualizacja: 2025-09-27 - Enhanced Analytics v1.2.1 (rename repo -> JournAI, instrukcje aktualizacji remote)*
