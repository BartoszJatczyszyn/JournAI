# 🎉 Przewodnik Użytkowania - Garmin Health Analytics

## ✅ **Migracja Zakończona Pomyślnie!**

Twoje dane zostały zmigrowane:
- **Daily Summaries: 277** (tętno spoczynkowe, kroki, kalorie)
- **Sleep Sessions: ~277** (dane o śnie)
- **Weight Records: 98** (pomiary wagi)
- **Journal Entries: 277** (dziennik do wypełnienia)

---

## 🚀 **Jak Korzystać z Systemu**

### 1. **📊 Podstawowa Analiza**
```bash
cd AI
python start_analysis.py
```
Pokaże Ci:
- Średni czas snu i ocenę snu
- Trend wagi
- Ostatnie wpisy w dzienniku

### 2. **📝 Aktualizacja Dziennika**

#### Szybka aktualizacja (interaktywna):
```bash
python quick_journal_update.py
```

#### Przez linię komend:
```bash
# Dzisiaj
python journal_cli.py --date today --mood good --meditated true --ashwagandha true --magnesium true

# Wczoraj
python journal_cli.py --date yesterday --mood okay --sleep-mask true --notes "Dobry sen"

# Konkretna data
python journal_cli.py --date 2025-08-04 --mood great --vitamin-d true
```

#### Pokaż wpis:
```bash
python journal_cli.py --date today --show
```

#### Lista ostatnich wpisów:
```bash
python journal_cli.py --list 7
```

### 3. **🔍 Szczegółowa Analiza**
```bash
python quick_analysis.py
```
Analizuje:
- Skuteczność suplementów vs jakość snu
- Wpływ medytacji na tętno i sen
- Optymalne warunki do spania
- Korelacje między nastrojem a aktywnością

### 4. **📈 Zarządzanie Danymi**
```bash
python data_manager.py
```
Podstawowe statystyki i zarządzanie danymi.

---

## 🎯 **Przykładowe Analizy**

### **Sprawdź wpływ ashwagandha na sen:**
1. Aktualizuj dziennik przez kilka dni z informacją o suplementach
2. Uruchom: `python quick_analysis.py`
3. Sprawdź sekcję "Supplement Effectiveness Analysis"

### **Optymalizuj środowisko snu:**
```bash
# Dodaj informacje o środowisku snu
python journal_cli.py --date today --sleep-mask true --ear-plugs false --bedroom-temp cool
```

### **Śledź nastrój vs aktywność:**
```bash
# Dodaj nastrój codziennie
python journal_cli.py --date today --mood good
python journal_cli.py --date yesterday --mood okay
```

---

## 📋 **Dostępne Pola w Dzienniku**

### **Podstawowe:**
- `--mood` (terrible/bad/okay/good/great)
- `--location` (tekst)
- `--alcohol` (tekst)
- `--notes` (tekst)

### **Zdrowie:**
- `--meditated` (true/false)
- `--calories-controlled` (true/false)
- `--sweet-cravings` (true/false)
- `--night-snacking` (true/false)

### **Suplementy:**
- `--ashwagandha` (true/false)
- `--magnesium` (true/false)
- `--vitamin-d` (true/false)
- `--supplements` (tekst - inne suplementy)

### **Środowisko snu:**
- `--sleep-mask` (true/false)
- `--ear-plugs` (true/false)
- `--bedroom-temp` (cold/cool/comfortable/warm/hot)
- `--read-before-sleep` (true/false)
- `--phone-before-sleep` (true/false)
- `--hot-bath` (true/false)

---

## 🔍 **Przykładowe Zapytania SQL**

### **Korelacja suplementów z jakością snu:**
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

### **Najlepsze dni (sen + nastrój + aktywność):**
```sql
SELECT 
    ds.day,
    ds.steps,
    ds.resting_heart_rate,
    s.sleep_score,
    s.sleep_duration_seconds/3600.0 as sleep_hours,
    j.mood
FROM garmin_daily_summaries ds
JOIN garmin_sleep_sessions s ON ds.day = s.day
JOIN daily_journal j ON ds.day = j.day
WHERE s.sleep_score > 80 AND ds.steps > 8000 AND j.mood = 'great'
ORDER BY ds.day DESC;
```

---

## 📊 **Dashboard w PostgreSQL**

Możesz też stworzyć widoki dla łatwiejszego dostępu:

```sql
CREATE VIEW daily_health_summary AS
SELECT 
    ds.day,
    ds.steps,
    ds.resting_heart_rate,
    s.sleep_score,
    s.sleep_duration_seconds/3600.0 as sleep_hours,
    w.weight_kg,
    j.mood,
    j.meditated,
    j.supplement_ashwagandha,
    j.supplement_magnesium,
    j.supplement_vitamin_d
FROM garmin_daily_summaries ds
LEFT JOIN garmin_sleep_sessions s ON ds.day = s.day
LEFT JOIN garmin_weight w ON ds.day = w.day
LEFT JOIN daily_journal j ON ds.day = j.day
ORDER BY ds.day DESC;
```

---

## 🎯 **Następne Kroki**

1. **Wypełnij dziennik** za ostatnie kilka dni
2. **Uruchom analizę** aby zobaczyć wzorce
3. **Eksperymentuj** z suplementami i śledź wyniki
4. **Optymalizuj** środowisko snu na podstawie danych
5. **Śledź trendy** długoterminowe

**Powodzenia w optymalizacji zdrowia na podstawie danych! 🚀**