# 🚀 Frontend Setup Guide

## Wymagania

### 1. Node.js (wymagane do React)
Pobierz i zainstaluj Node.js z: https://nodejs.org/
- Wybierz wersję LTS (Long Term Support)
- Po instalacji restart komputera

### 2. Sprawdź instalację
Otwórz nowy terminal/PowerShell i sprawdź:
```bash
node --version
npm --version
```

## 🔧 Instalacja Frontend

### 1. Zainstaluj zależności React
```bash
cd AI/frontend-react
npm install
```

### 2. Uruchom frontend
```bash
npm start
```

Frontend będzie dostępny na: **http://localhost:3000**

## 🔥 Szybkie Uruchomienie (Pełny Stack)

### 1. Terminal 1 - Backend (Python)
```bash
cd AI/Diary-AI-BE/scripts
python start_enhanced_backend.py
```

### 2. Terminal 2 - Frontend (React)
```bash
cd AI/frontend-react
npm start
```

## 📊 Dostępne Funkcje

### Dashboard (📊)
- Statystyki zdrowia (sen, RHR, waga)
- Wykresy trendów snu i wagi
- Rozkład nastroju

### Dziennik (📝)
- Formularz do wprowadzania danych dziennych
- Nastrój, medytacja, suplementy
- Środowisko snu, nawyki

### Analityka (📈)
- Analiza skuteczności suplementów
- Wpływ medytacji na zdrowie
- Korelacje między danymi
- Optymalizacja środowiska snu

### Dane (📋)
- Tabela wszystkich danych zdrowotnych
- Filtrowanie po datach
- Eksport danych (CSV/JSON)

## 🛠️ Rozwiązywanie Problemów

### "npm not recognized"
- Zainstaluj Node.js z nodejs.org
- Restart komputera
- Otwórz nowy terminal

### "Module not found"
```bash
cd AI/frontend-react
npm install
```

### "Database connection failed"
- Sprawdź czy PostgreSQL jest uruchomiony
- Zweryfikuj config.env
- Uruchom migrację: `python run_migration.py`

### Port już zajęty
- Frontend (3000): Zamknij inne React aplikacje
- Backend Enhanced (5002): Zamknij inne Flask aplikacje

## 🎯 Następne Kroki

1. **Uruchom backend Enhanced**: `python scripts/start_enhanced_backend.py`
2. **Zainstaluj Node.js** (jeśli nie masz)
3. **Zainstaluj frontend**: `npm install` w folderze `AI/frontend-react`
4. **Uruchom frontend**: `npm start`
5. **Otwórz**: http://localhost:3000

## 📱 Struktura Aplikacji

```
AI/
├── scripts/                # Backend (Flask) i narzędzia
│   ├── backend_api_enhanced.py
│   ├── (usunięto stary backend v3)
│   ├── start_enhanced_backend.py
│   ├── start_enhanced_backend.py
│   └── ...
├── frontend-react/
│   ├── package.json        # React dependencies
│   ├── src/
│   │   ├── App.js         # Main React app
│   │   ├── components/    # React components
│   │   └── services/      # API communication
│   └── public/            # Static files
├── config.env             # Database configuration
└── requirements.txt       # Zależności backend/migracji
```

## 🔗 API Endpoints

- `GET /api/stats` - Podstawowe statystyki
- `GET /api/sleep-trend` - Trend snu
- `GET /api/weight-trend` - Trend wagi
- `GET /api/mood-distribution` - Rozkład nastroju
- `PUT /api/journal/{date}` - Aktualizacja dziennika
- `GET /api/analytics/*` - Różne analizy
- `GET /api/health-data` - Dane do tabeli
- `GET /api/export` - Eksport danych

**Powodzenia! 🎉**