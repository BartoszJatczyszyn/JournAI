# 🛠️ Naprawka Migracji Danych o Śnie

## 🔍 **Problem zidentyfikowany:**

Z logów wynika, że tabela `garmin_sleep_sessions` nadal używa typu `INTEGER` zamiast `BIGINT` dla kolumny `sleep_id`, co powoduje błąd:

```
psycopg2.errors.NumericValueOutOfRange: integer out of range
```

**Przykładowe problematyczne ID:** `1730419180000` (za duże dla INTEGER)

## ✅ **Rozwiązanie:**

### 1. **Napraw strukturę tabeli:**

```sql
-- Usuń istniejącą tabelę (jest pusta)
DROP TABLE IF EXISTS garmin_sleep_sessions CASCADE;

-- Utwórz nową tabelę z BIGINT
CREATE TABLE garmin_sleep_sessions (
    sleep_id BIGINT PRIMARY KEY,
    day DATE,
    sleep_start TIMESTAMP,
    sleep_end TIMESTAMP,
    sleep_duration_seconds INTEGER,
    deep_sleep_seconds INTEGER,
    light_sleep_seconds INTEGER,
    rem_sleep_seconds INTEGER,
    awake_seconds INTEGER,
    nap_duration_seconds INTEGER,
    sleep_score INTEGER,
    sleep_quality VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dodaj indeks dla lepszej wydajności
CREATE INDEX idx_sleep_sessions_day ON garmin_sleep_sessions(day);
```

### 2. **Uruchom skrypt naprawczy:**

```bash
cd AI
python fix_sleep_table.py
```

### 3. **Uruchom pełną migrację ponownie:**

```bash
python enhanced_migration.py
```

## 🎯 **Oczekiwane rezultaty po naprawie:**

```
Daily Summaries: 277
Sleep Sessions: ~277 (zamiast 0)
Weight Records: 98
Journal Entries: 277
```

## 🔧 **Alternatywne rozwiązanie przez PostgreSQL:**

Jeśli skrypty Python nie działają, możesz naprawić bezpośrednio w PostgreSQL:

```bash
# Połącz się z bazą danych
psql -h localhost -U diary_user -d diary

# Wykonaj SQL
DROP TABLE IF EXISTS garmin_sleep_sessions CASCADE;

CREATE TABLE garmin_sleep_sessions (
    sleep_id BIGINT PRIMARY KEY,
    day DATE,
    sleep_start TIMESTAMP,
    sleep_end TIMESTAMP,
    sleep_duration_seconds INTEGER,
    nap_duration_seconds INTEGER,
    sleep_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# Wyjdź z psql
\q
```

## 📊 **Sprawdzenie po naprawie:**

```bash
python direct_db_check.py
```

Powinno pokazać:
- ✅ sleep_id column type: bigint
- ✅ Table structure is correct (BIGINT)
- 📊 garmin_sleep_sessions: >0 records

## 🚨 **Dlaczego to się stało:**

1. SQLAlchemy utworzyło tabelę z domyślnym typem INTEGER
2. Mimo zmiany w kodzie na BigInteger, istniejąca tabela nie została zaktualizowana
3. Garmin używa timestamp-ów jako ID (np. 1730419180000), które przekraczają zakres INTEGER

## 🔄 **Zapobieganie w przyszłości:**

Dodaj do skryptu migracji automatyczne sprawdzanie i naprawę struktury tabeli przed migracją danych.