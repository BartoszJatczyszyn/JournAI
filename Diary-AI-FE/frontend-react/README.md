# 🏥 Garmin Health Analytics - React Frontend

Nowoczesny frontend w React dla systemu Enhanced Garmin Health Analytics z zaawansowaną analityką AI.

## 🚀 Funkcjonalności

### 📊 Dashboard
- Przegląd kluczowych metryk zdrowotnych
- Interaktywne wykresy trendów
- Macierz korelacji między metrykami
- Statystyki danych w czasie rzeczywistym

### 🧠 Enhanced Analytics
- **Zaawansowane korelacje**: Analiza wielowymiarowych relacji (Pearson, Spearman, Kendall)
- **Analiza klastrów**: AI-powered wykrywanie wzorców zdrowotnych
- **Wzorce temporalne**: Analiza wzorców według dni tygodnia i trendów tygodniowych
- **Analiza regeneracji**: Kompleksowa ocena odzyskiwania sił

### 🔮 Predykcje
- Prognozy poziomu energii (7 dni)
- Prognozy jakości snu
- Prognozy nastroju
- Trendy zdrowotne z oceną kierunku

### 💡 Personalizowane Insights
- Spersonalizowane rekomendacje
- Optymalizacja metryk zdrowotnych
- Porównania okresów czasowych

### 🔬 Specjalistyczne Analizy
- **Analiza snu**: Efektywność, timing, wpływ na wydajność
- **Analiza stresu**: Wzorce godzinowe, triggery, regeneracja
- **Analiza aktywności**: Intensywność, konsystencja, korelacje

## 🛠️ Instalacja

### Wymagania
- Node.js 18+ (LTS; zalecane >=18.18.0 lub >=20) 
- npm lub yarn
- Backend API uruchomiony na porcie 5002

### Kroki instalacji

1. **Przejdź do katalogu frontend-react:**
   ```bash
   cd AI/frontend-react
   ```

2. **Zainstaluj zależności:**
   ```bash
   npm install
   # lub
   yarn install
   ```

3. **Skonfiguruj zmienne środowiskowe (opcjonalne):**
   ```bash
   # Utwórz plik .env w katalogu frontend-react
   echo "REACT_APP_API_URL=http://localhost:5002" > .env
   ```

4. **Uruchom aplikację:**
   ```bash
   npm start
   # lub
   yarn start
   ```

5. **Otwórz w przeglądarce:**
   ```
   http://localhost:3000
   ```

## 🔧 Konfiguracja

### Zmienne środowiskowe
```bash
# .env
REACT_APP_API_URL=http://localhost:5002  # URL backendu API
```

### Proxy konfiguracja
Frontend jest skonfigurowany z proxy do backendu w `package.json`:
```json
{
  "proxy": "http://localhost:5002"
}
```

## 📱 Responsywność

Aplikacja jest w pełni responsywna i działa na:
- 🖥️ Desktop (1200px+)
- 💻 Laptop (768px - 1199px)
- 📱 Tablet (480px - 767px)
- 📱 Mobile (< 480px)

## 🎨 Funkcjonalności UI/UX

### Tryb ciemny
- Automatyczne wykrywanie preferencji systemowych
- Przełączanie między trybem jasnym i ciemnym
- Zapisywanie preferencji w localStorage

### Nawigacja
- Responsywny sidebar z opisami sekcji
- Breadcrumbs i aktywne stany nawigacji
- Mobilne menu hamburger

### Komponenty
- **MetricCard**: Karty metryk z trendami i animacjami
- **HealthChart**: Wykresy zdrowotne (linia, obszar, słupki)
- **CorrelationMatrix**: Interaktywna macierz korelacji
- **ClusterAnalysis**: Wizualizacja wzorców AI
- **TemporalPatterns**: Analiza wzorców czasowych
- **RecoveryAnalysis**: Analiza regeneracji z rekomendacjami

### Wykresy i wizualizacje
- **Recharts**: Biblioteka wykresów React
- **Interaktywne tooltips**: Szczegółowe informacje przy hover
- **Animacje**: Płynne przejścia i ładowanie danych
- **Kolory adaptacyjne**: Automatyczne dostosowanie do trybu ciemnego

## 🔗 Integracja z Backend API

### Endpointy wykorzystywane:
```javascript
// Enhanced Analytics
/api/analytics/enhanced/comprehensive
/api/analytics/enhanced/correlations
/api/analytics/enhanced/clusters
/api/analytics/enhanced/temporal-patterns
/api/analytics/enhanced/recovery

// Specialized Analytics
/api/analytics/sleep/comprehensive
/api/analytics/stress/comprehensive
/api/analytics/activity/comprehensive

// Predictions
/api/predictions/energy
/api/predictions/sleep
/api/predictions/mood
/api/predictions/comprehensive

// Insights
/api/insights/personalized
/api/insights/optimization
```

### Obsługa błędów
- Automatyczne retry przy błędach sieciowych
- Graceful degradation przy braku danych
- Toast notifications dla użytkownika
- Fallback UI dla stanów błędów

## 📊 Struktura komponentów

```
src/
├── components/           # Komponenty wielokrotnego użytku
│   ├── Navbar.js        # Górny pasek nawigacji
│   ├── Sidebar.js       # Boczne menu
│   ├── MetricCard.js    # Karty metryk
│   ├── HealthChart.js   # Wykresy zdrowotne
│   ├── CorrelationMatrix.js  # Macierz korelacji
│   ├── ClusterAnalysis.js    # Analiza klastrów
│   ├── TemporalPatterns.js   # Wzorce temporalne
│   ├── RecoveryAnalysis.js   # Analiza regeneracji
│   ├── LoadingSpinner.js     # Komponenty ładowania
│   └── ErrorMessage.js       # Obsługa błędów
├── pages/               # Strony aplikacji
│   ├── Dashboard.js     # Główny dashboard
│   ├── Analytics.js     # Zaawansowana analityka
│   ├── Predictions.js   # Prognozy
│   ├── Sleep.js         # Analiza snu
│   ├── Stress.js        # Analiza stresu
│   ├── Activity.js      # Analiza aktywności
│   ├── Insights.js      # Personalizowane insights
│   └── Settings.js      # Ustawienia
├── context/             # Context API
│   └── HealthDataContext.js  # Zarządzanie stanem danych
├── services/            # Usługi API
│   └── api.js          # Konfiguracja i endpointy API
└── App.js              # Główny komponent aplikacji
```

## 🎯 Najważniejsze funkcjonalności

### 1. Real-time Analytics
- Automatyczne odświeżanie danych
- Live updates metryk zdrowotnych
- Progresywne ładowanie danych

### 2. AI-Powered Insights
- Machine learning korelacje
- Automatyczne wykrywanie wzorców
- Predykcyjne analizy zdrowotne

### 3. Personalizacja
- Dostosowane rekomendacje
- Konfigurowalne okresy analizy
- Personalizowane dashboardy

### 4. Zaawansowane wizualizacje
- Interaktywne wykresy
- Macierze korelacji
- Radar charts dla wzorców
- Radial progress indicators

## 🚀 Deployment

### Build produkcyjny
```bash
npm run build
# lub
yarn build
```

### Serwowanie statyczne
```bash
# Zainstaluj serve globalnie
npm install -g serve

# Serwuj build
serve -s build -l 3000
```

### Docker (opcjonalnie)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 Debugowanie

### Logi developerskie
- Console.log dla API calls
- Error boundaries dla komponentów
- Performance monitoring

### Narzędzia deweloperskie
- React Developer Tools
- Redux DevTools (jeśli używane)
- Network tab dla API calls

## 📈 Performance

### Optymalizacje
- Lazy loading komponentów
- Memoization dla ciężkich obliczeń
- Virtualizacja dla dużych list
- Code splitting

### Metryki
- First Contentful Paint < 2s
- Time to Interactive < 3s
- Lighthouse Score > 90

## 🤝 Contributing

1. Fork repository
2. Utwórz feature branch
3. Commit changes
4. Push do branch
5. Utwórz Pull Request

## 📄 Licencja

MIT License - zobacz plik LICENSE dla szczegółów.

---

**Utworzono przez**: Enhanced Analytics System v1.0  
**Data**: 2024-01-14  
**Status**: ✅ Gotowy do produkcji