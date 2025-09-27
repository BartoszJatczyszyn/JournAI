# 🏥 Garmin Health Data Analysis System

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

### 💡 Personalizowane insights:
- `/api/insights/personalized` - spersonalizowane rekomendacje
- `/api/insights/optimization` - optymalizacja metryk zdrowotnych
- `/api/analytics/compare/periods` - porównania okresów

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

## 📖 Dokumentacja

- [Enhanced Analytics Documentation](docs/ENHANCED_ANALYTICS_DOCUMENTATION.md) - **NOWE! AI Analytics**
- [Przewodnik użytkownika](docs/USAGE_GUIDE.md)
- [Konfiguracja frontendu](docs/FRONTEND_SETUP.md)
- [Kompletny setup](docs/COMPLETE_SETUP_GUIDE.md)

## 🔗 Przykładowe analizy

```sql
-- Korelacja nastroju z aktywnością
SELECT d.mood, d.energy_level, g.steps, g.calories_total
FROM daily_journal d 
JOIN garmin_daily_summaries g ON d.day = g.day;

-- Wpływ snu na regenerację
SELECT s.sleep_score, s.deep_sleep, g.rhr, d.sleep_quality_manual
FROM garmin_sleep_sessions s
JOIN garmin_daily_summaries g ON s.day = g.day
LEFT JOIN daily_journal d ON s.day = d.day;
```

## 🧪 Testowanie Enhanced Analytics

```bash
# Test bezpośredni modułów (każdy plik ma tryb main)
cd Diary-AI-BE/scripts && python enhanced_analytics_engine.py
cd Diary-AI-BE/scripts && python specialized_analytics.py
cd Diary-AI-BE/scripts && python predictive_analytics.py
```

## 📦 Dodatkowe zależności dla Enhanced Analytics

```bash
# Instalacja pakietów ML/AI
pip install numpy scipy scikit-learn

# Lub automatycznie przy starcie
cd Diary-AI-BE/scripts && python start_enhanced_backend.py  # sprawdzi i zainstaluje
```

## 🔧 Konfiguracja Enhanced Analytics

### Minimalne wymagania danych:
- **30+ dni** danych dziennych dla podstawowej analizy
- **60+ dni** dla analizy predykcyjnej
- **90+ dni** dla pełnej analizy trendów
- **1000+ pomiarów** tętna/stresu dla analizy wzorców

### Porty serwerów:
- **Port 5002**: Enhanced Backend API (AI Analytics, domyśnie uruchamiany)

## 🧱 Struktura i wzorce (SOLID)

Szczegóły struktury projektu: zobacz PROJECT_STRUCTURE.md


- Warstwa services (Python):
  - `scripts/services/journal_service.py` – operacje na `daily_journal`
  - `scripts/services/trends_service.py` – zapytania trendów (sen, waga, nastrój)
  - `scripts/services/health_service.py` – health check, status
- Endpointy Flask korzystają z serwisów (separacja odpowiedzialności)
- Wspólne utilsy: `scripts/utils.py`, `scripts/db.py`, `scripts/model_utils.py`

## 📊 Status projektu

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

### Kroki publikacji (jeśli tworzysz nowe repo)
```bash
git init
git add .
git commit -m "Initial project import"
git branch -M master
# utwórz repo na GitHub (lub użyj istniejącego) i dodaj remote:
git remote add origin https://github.com/<twoj-user>/Journal-AI.git
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
*Ostatnia aktualizacja: 2025-08-25 - Enhanced Analytics v1.1*
