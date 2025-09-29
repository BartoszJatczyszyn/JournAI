## 🚀 Frontend Setup Guide

Ten dokument opisuje jak uruchomić frontend lokalnie (React) podczas developmentu. Frontend znajdujący się w repozytorium: `Diary-AI-FE/frontend-react`.
Wymagania

- Node.js (zalecane wersje: >=18.18.0 lub >=20.0.0)
- npm (do zarządzania pakietami)

Sprawdź instalację:

```bash
node --version
npm --version
```

Instalacja i start (macOS / zsh)

```bash
# Przejdź do katalogu frontendu
cd Diary-AI-FE/frontend-react

# Zainstaluj zależności
npm install

# Uruchom dev server
npm start
```

Po uruchomieniu zobaczysz:

- Local: http://localhost:3000
- Frontend jest skonfigurowany z `proxy` wskazującym na `http://localhost:5002`, dzięki czemu wywołania API z frontendu trafią do backendu uruchomionego lokalnie lub w Dockerze.

Uwaga: jeśli chcesz budować produkcyjną wersję frontendu, użyj:

```bash
npm run build
# wynik zostanie umieszczony w katalogu `build/`
```

Problemy i szybkie rozwiązania

- "Port 3000 już zajęty": znajdź proces i zabij go (macOS):
	```bash
	lsof -i :3000
	kill -9 <PID>
	```
- "Node/npm nie znaleziono": upewnij się, że Node jest zainstalowany i uruchamiasz nowy terminal (zsh musi mieć poprawny PATH)

Zalecane: uruchom backend (Docker) w osobnym terminalu:

```bash
# z katalogu repo
docker compose up -d --build
```

Frontend i backend będą wtedy komunikować się automatycznie przejściowo przez proxy (dev).
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
cd AI\frontend
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
cd AI
python start_backend.py
```

### 2. Terminal 2 - Frontend (React)
```bash
cd AI\frontend
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
cd AI\frontend
npm install
```

### "Database connection failed"
- Sprawdź czy PostgreSQL jest uruchomiony
- Zweryfikuj config.env
- Uruchom migrację: `python enhanced_migration.py`

### Port już zajęty
- Frontend (3000): Zamknij inne React aplikacje
- Backend (5000): Zamknij inne Flask aplikacje

## 🎯 Następne Kroki

1. **Uruchom backend**: `python start_backend.py`
2. **Zainstaluj Node.js** (jeśli nie masz)
3. **Zainstaluj frontend**: `npm install` w folderze `AI\frontend`
4. **Uruchom frontend**: `npm start`
5. **Otwórz**: http://localhost:3000

## 📱 Struktura Aplikacji

```
AI/
├── backend_api.py          # Flask API server
├── start_backend.py        # Backend startup script
├── frontend/
│   ├── package.json        # React dependencies
│   ├── src/
│   │   ├── App.js         # Main React app
│   │   ├── components/    # React components
│   │   └── services/      # API communication
│   └── public/            # Static files
└── config.env             # Database configuration
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