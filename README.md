# Garmin Health Data Migration to PostgreSQL

Ten projekt umożliwia migrację danych zdrowotnych z Garmin do bazy danych PostgreSQL z dodatkową tabelą `daily_journal` do śledzenia codziennych nawyków i suplementów.

## 🚀 Szybki Start

### 1. Przygotowanie środowiska

```bash
# Zainstaluj wymagane pakiety
python setup_migration.py
```

### 2. Konfiguracja bazy danych

Edytuj plik `config.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=garmin_health
DB_USER=postgres
DB_PASSWORD=twoje_haslo
```

### 3. Uruchomienie migracji

```bash
python run_migration.py
```

## 📊 Struktura Danych

### Tabele w bazie danych:

1. **garmin_daily_summaries** - Dzienne podsumowania aktywności
2. **garmin_sleep_sessions** - Dane o śnie
3. **garmin_activities** - Aktywności sportowe
4. **garmin_weight** - Pomiary wagi
5. **daily_journal** - Dziennik dzienny z dodatkowymi informacjami

### Daily Journal - Pola:

- **Podstawowe**: lokalizacja, nastrój, alkohol, medytacja
- **Żywienie**: kontrola kalorii, słodkie zachcianki, nocne przekąski
- **Suplementy**: ashwagandha, magnez, witamina D
- **Sen**: maska do spania, zatyczki do uszu, temperatura sypialni, czytanie przed snem

## 🔧 Zarządzanie Danymi

### Aktualizacja wpisu w dzienniku:

```python
from data_manager import GarminDataManager
from datetime import date

manager = GarminDataManager()

# Aktualizuj wpis na dzisiaj
manager.update_journal_entry(
    day=date.today(),
    mood="good",
    meditated=True,
    supplement_ashwagandha=True,
    supplement_magnesium=True,
    used_sleep_mask=True,
    notes="Dobry dzień, dużo energii"
)
```

### Analiza danych:

```python
# Analiza snu
sleep_analysis = manager.get_sleep_analysis(30)
print(f"Średni czas snu: {sleep_analysis['avg_duration_hours']:.1f} godzin")

# Trend wagi
weight_trend = manager.get_weight_trend(90)
print(f"Zmiana wagi: {weight_trend['weight_change']:+.1f} kg")
```

## 📁 Struktura Plików

```
├── HealthData/                 # Twoje dane z Garmin
│   ├── DBs/                   # Bazy SQLite
│   ├── Sleep/                 # Pliki JSON ze snem
│   ├── RHR/                   # Tętno spoczynkowe
│   └── Weight/                # Dane o wadze
├── enhanced_migration.py      # Główny skrypt migracji
├── data_manager.py           # Zarządzanie danymi
├── setup_migration.py        # Instalacja i konfiguracja
├── run_migration.py          # Uruchomienie migracji
├── config.env               # Konfiguracja bazy danych
└── requirements.txt         # Wymagane pakiety Python
```

## 🔍 Przykładowe Zapytania SQL

### Korelacja między suplementami a jakością snu:

```sql
SELECT 
    j.supplement_ashwagandha,
    j.supplement_magnesium,
    AVG(s.sleep_score) as avg_sleep_score,
    AVG(s.sleep_duration_seconds/3600.0) as avg_sleep_hours
FROM daily_journal j
JOIN garmin_sleep_sessions s ON j.day = s.day
WHERE s.sleep_score IS NOT NULL
GROUP BY j.supplement_ashwagandha, j.supplement_magnesium;
```

### Analiza nastroju vs aktywność:

```sql
SELECT 
    j.mood,
    AVG(ds.steps) as avg_steps,
    AVG(ds.resting_heart_rate) as avg_rhr,
    COUNT(*) as days_count
FROM daily_journal j
JOIN garmin_daily_summaries ds ON j.day = ds.day
WHERE j.mood IS NOT NULL
GROUP BY j.mood
ORDER BY avg_steps DESC;
```

### Wpływ medytacji na sen:

```sql
SELECT 
    j.meditated,
    AVG(s.sleep_score) as avg_sleep_score,
    AVG(s.sleep_duration_seconds/3600.0) as avg_sleep_hours
FROM daily_journal j
JOIN garmin_sleep_sessions s ON j.day = s.day
WHERE j.meditated IS NOT NULL AND s.sleep_score IS NOT NULL
GROUP BY j.meditated;
```

## 🛠️ Rozwiązywanie Problemów

### Błąd połączenia z bazą danych:
1. Sprawdź czy PostgreSQL jest uruchomiony
2. Zweryfikuj dane w `config.env`
3. Utwórz bazę danych: `CREATE DATABASE garmin_health;`

### Brak danych Garmin:
1. Sprawdź czy folder `HealthData` istnieje
2. Upewnij się, że zawiera podfoldery: `Sleep`, `RHR`, `Weight`, `DBs`

### Problemy z pakietami Python:
```bash
pip install -r requirements.txt
```

## 📈 Możliwości Analizy

Po migracji możesz analizować:
- Korelacje między suplementami a jakością snu
- Wpływ medytacji na tętno spoczynkowe
- Związek między nastrojem a aktywnością fizyczną
- Trendy wagi w czasie
- Optymalne warunki do snu
- Skuteczność różnych suplementów

## 🔄 Aktualizacja Danych

Skrypt można uruchamiać wielokrotnie - automatycznie aktualizuje istniejące dane i dodaje nowe wpisy.

## 📝 Licencja

Ten projekt jest dostępny na licencji MIT.
