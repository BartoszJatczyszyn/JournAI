# 🚀 Kompletny Przewodnik Instalacji - Health Dashboard

## 🔧 Wymagane Oprogramowanie

### 1. Python (Backend)
**Sprawdź czy masz Python:**
```powershell
python --version
# lub
python3 --version
# lub
py --version
```

**Jeśli nie masz Python:**
- Pobierz z: https://www.python.org/downloads/
- ✅ **WAŻNE**: Zaznacz "Add Python to PATH" podczas instalacji
- Restart komputera po instalacji

### 2. Node.js (Frontend React)
**Sprawdź czy masz Node.js:**
```powershell
node --version
npm --version
```

**Jeśli nie masz Node.js:**
- Pobierz z: https://nodejs.org/
- Wybierz wersję LTS (Long Term Support)
- Restart komputera po instalacji

## 🏥 Uruchomienie Health Dashboard

### Opcja A: Masz Python i Node.js ✅

#### 1. Backend (Terminal 1)
```powershell
cd AI
python -m pip install flask flask-cors python-dotenv psycopg2-binary
python start_backend.py
```

#### 2. Frontend (Terminal 2)
```powershell
cd AI\frontend
npm install
npm start
```

### Opcja B: Tylko Python (bez Node.js) 🐍

Stworzę prostą wersję HTML/JavaScript bez React:

#### 1. Backend
```powershell
cd AI
python -m pip install flask flask-cors python-dotenv psycopg2-binary
python backend_api.py
```

#### 2. Frontend (prosty HTML)
Otwórz: `AI/simple_frontend.html` w przeglądarce

### Opcja C: Tylko przeglądanie danych 📊

Jeśli chcesz tylko zobaczyć dane bez frontendu:

```powershell
cd AI
python quick_analysis.py
python start_analysis.py
```

## 🎯 Dostęp do Aplikacji

Po uruchomieniu:
- **Backend API**: http://localhost:5000
- **React Frontend**: http://localhost:3000 (jeśli masz Node.js)
- **Simple Frontend**: Otwórz `simple_frontend.html` w przeglądarce

## 🛠️ Rozwiązywanie Problemów

### "python not recognized"
1. Zainstaluj Python z python.org
2. ✅ Zaznacz "Add to PATH"
3. Restart komputera
4. Spróbuj: `py` zamiast `python`

### "pip not recognized"
```powershell
python -m pip install flask
# lub
py -m pip install flask
```

### "npm not recognized"
1. Zainstaluj Node.js z nodejs.org
2. Restart komputera
3. Otwórz nowy terminal

### "Database connection failed"
1. Sprawdź czy PostgreSQL działa
2. Sprawdź config.env
3. Uruchom migrację: `python enhanced_migration.py`

## 📱 Funkcje Dashboard

### 📊 Dashboard
- Statystyki zdrowia (sen, tętno, waga)
- Wykresy trendów
- Rozkład nastroju

### 📝 Dziennik
- Formularz wprowadzania danych
- Nastrój, medytacja, suplementy
- Środowisko snu

### 📈 Analityka
- Skuteczność suplementów
- Wpływ medytacji
- Korelacje danych
- Rekomendacje

### 📋 Dane
- Tabela wszystkich danych
- Filtrowanie
- Eksport CSV/JSON

## 🚀 Szybki Start (Minimalna wersja)

Jeśli masz problemy z instalacją, użyj prostej wersji:

```powershell
cd AI
# Sprawdź dane
python simple_check.py

# Podstawowa analiza
python quick_analysis.py

# Aktualizuj dziennik
python journal_cli.py --date today --mood good --meditated true
```

## 📞 Pomoc

Jeśli nic nie działa:
1. Sprawdź czy masz Python: `python --version`
2. Sprawdź czy masz dane: sprawdź folder `HealthData`
3. Sprawdź bazę danych: `python simple_check.py`
4. Uruchom prostą analizę: `python quick_analysis.py`

**Powodzenia! 🎉**