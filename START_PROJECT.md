# 🏥 Garmin Health Dashboard - Instrukcja Uruchomienia

## 📋 Wymagania Systemowe

- **Python**: 3.12+ (rekomendowane 3.13)
- **Node.js**: 18+ (LTS; frontend-react wymaga >=18.18.0 lub >=20)
- **PostgreSQL**: 12+ (opcjonalnie, dla pełnej funkcjonalności)
- **System**: macOS/Linux/Windows

## 🚀 Szybkie Uruchomienie

### 1. Backend API (Python Flask)

```bash
# Przejdź do katalogu projektu
cd AI/Diary-AI-BE/scripts

# Uruchom Enhanced Backend (AI Analytics)
python3 start_enhanced_backend.py
```

Backend Enhanced będzie domyślnie dostępny na: `http://localhost:5002`. (Stary backend v3 został wycofany z instrukcji).

### 2. Frontend React

```bash
# Przejdź do katalogu React
cd AI/Diary-AI-FE/frontend-react

# Zainstaluj zależności (tylko przy pierwszym uruchomieniu)
npm install

# Uruchom aplikację React
npm start
```

Frontend będzie dostępny na: `http://localhost:3000`

## 📁 Struktura Projektu

```
AI/
├── Diary-AI-FE/frontend-react/          # Aplikacja React
│   ├── src/
│   │   ├── components/      # Komponenty React
│   │   ├── pages/          # Strony (Dashboard, Activity, etc.)
│   │   ├── context/        # Context API (HealthDataContext)
│   │   └── services/       # API klient
│   ├── public/
│   └── package.json
├── Diary-AI-BE/scripts/                 # Backend Python
│   ├── backend_api_enhanced.py      # Główny plik API (Enhanced)
│   ├── start_enhanced_backend.py    # Skrypt uruchamiający Enhanced
│   └── *.py               # Inne skrypty
├── docs/                   # Dokumentacja
├── Diary-AI-BE/config.env             # Konfiguracja bazy danych
└── README.md
```

## 🔧 Szczegółowa Konfiguracja

### Backend (Python Flask)

1. **Automatyczne uruchomienie (Enhanced)**:
   ```bash
   cd AI/scripts
   python3 start_enhanced_backend.py
   ```

2. **Ręczne uruchomienie**:
   ```bash
   cd AI/scripts
   pip install -r ../../Diary-AI-BE/requirements.txt
   python3 backend_api_enhanced.py
   ```

### Frontend (React)

1. **Pierwsza instalacja**:
   ```bash
   cd AI/frontend-react
   npm install
   npm start
   ```

2. **Kolejne uruchomienia**:
   ```bash
   cd AI/frontend-react
   npm start
   ```

## 🗄️ Baza Danych (Opcjonalna)

Projekt wymaga działającego PostgreSQL dla pełnej funkcjonalności:

1. **Zainstaluj PostgreSQL**
2. **Skonfiguruj `config.env`**:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=diary
   DB_USER=diary_user
   DB_PASSWORD=diary123
   ```

## 📊 Dostępne Strony

- **Dashboard** (`/dashboard`) - Główny przegląd zdrowia
- **Analytics** (`/analytics`) - Zaawansowane analizy
- **Predictions** (`/predictions`) - Predykcje AI
- **Sleep** (`/sleep`) - Analiza snu
- **Stress** (`/stress`) - Monitoring stresu
- **Activity** (`/activity`) - Aktywność fizyczna
- **Insights** (`/insights`) - Personalne wnioski
- **Settings** (`/settings`) - Ustawienia aplikacji

## 🔍 Rozwiązywanie Problemów

### Port 5000 zajęty (macOS AirPlay)
Backend automatycznie używa portu 5002.

### Brak danych w dashboard
Aplikacja wymaga poprawnie działającego backendu i bazy danych; w razie błędów wyświetli komunikat.

### Błędy instalacji Python
```bash
# Sprawdź wersję Python
python3 --version

# Reinstaluj zależności
cd AI/scripts
pip install -r requirements.txt --force-reinstall
```

### Błędy React
```bash
cd AI/frontend-react
rm -rf node_modules package-lock.json
npm install
npm start
```

## 🎯 Szybki Test

1. Uruchom backend Enhanced: `cd AI/Diary-AI-BE/scripts && python3 start_enhanced_backend.py`
2. Uruchom frontend: `cd AI/Diary-AI-FE/frontend-react && npm start`
3. Otwórz: `http://localhost:3000`
4. Sprawdź czy dashboard się ładuje z danymi

## 📞 Wsparcie

Jeśli masz problemy:
1. Sprawdź logi w terminalu
2. Upewnij się że porty 3000 i 5002 są wolne
3. Sprawdź czy wszystkie zależności są zainstalowane