# 🏥 Garmin Health Analytics - React Frontend

A modern React frontend for the Enhanced Garmin Health Analytics system with advanced AI analytics.

## 🚀 Features

### 📊 Dashboard
- Overview of key health metrics
- Interactive trend charts
- Correlation matrix between metrics
- Statystyki danych w czasie rzeczywistym

### 🧠 Enhanced Analytics
- **Advanced correlations**: Analiza wielowymiarowych relacji (Pearson, Spearman, Kendall)
- **Cluster analysis**: AI-powered detection of health patterns
- **Temporal patterns**: Analysis of patterns by days of the week and weekly trends
- **Recovery analysis**: Comprehensive assessment of recovery

### 🔮 Predictions
- 7-day energy level forecasts
- Sleep quality forecasts
- Mood forecasts
- Health trends with direction assessment

### 💡 Personalized insights
- Personalized recommendations
- Optimization of health metrics
- Time-period comparisons

### 🔬 Specialized analyses
- **Sleep analysis**: Efficiency, timing, impact on performance
- **Stress analysis**: Hourly patterns, triggers, recovery
- **Activity analysis**: Intensity, consistency, correlations

## 🛠️ Installation

### Requirements
- Node.js 18+ (LTS; zalecane >=18.18.0 lub >=20) 
- npm or yarn
- Backend API running on port 5002

### Installation steps

1. **Go to the frontend-react directory:**
   ```bash
   cd AI/frontend-react
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # lub
   yarn install
   ```

3. **Configure environment variables (optional):**
   ```bash
   # Create the .env file in the frontend-react directory
   echo "REACT_APP_API_URL=http://localhost:5002" > .env
   ```

4. **Run the application:**
   ```bash
   npm start
   # lub
   yarn start
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Environment variables
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

## 📱 Responsiveness

The application is fully responsive and works on:
- 🖥️ Desktop (1200px+)
- 💻 Laptop (768px - 1199px)
- 📱 Tablet (480px - 767px)
- 📱 Mobile (< 480px)

## 🎨 UI/UX Features

### Tryb ciemny
- Automatyczne wykrywanie preferencji systemowych
- Switching between light and dark mode
- Zapisywanie preferencji w localStorage

### Nawigacja
- Responsywny sidebar z opisami sekcji
- Breadcrumbs i aktywne stany nawigacji
- Mobilne menu hamburger

### Komponenty
- **MetricCard**: Metric cards z trendami i animacjami
- **HealthChart**: Health charts (line, area, bars)
- **CorrelationMatrix**: Interactive correlation matrix
- **ClusterAnalysis**: Visualization of AI patterns
- **TemporalPatterns**: Temporal pattern analysis
- **RecoveryAnalysis**: Recovery analysis z rekomendacjami

### Charts and visualizations
- **Recharts**: React charting library
- **Interactive tooltips**: Detailed info on hover
- **Animations**: Smooth transitions and data loading
- **Adaptive colors**: Automatic adjustment to dark mode

## 🔗 Backend API Integration

### Endpoints used:
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

### Error handling
- Automatic retries on network errors
- Graceful degradation when data is missing
- Toast notifications for the user
- Fallback UI for error states

## 📊 Component structure

```
src/
├── components/           # Reusable components
│   ├── Navbar.js        # Top navigation bar
│   ├── Sidebar.js       # Side menu
│   ├── MetricCard.js    # Metric cards
│   ├── HealthChart.js   # Health charts
│   ├── CorrelationMatrix.js  # Macierz korelacji
│   ├── ClusterAnalysis.js    # Cluster analysis
│   ├── TemporalPatterns.js   # Temporal patterns
│   ├── RecoveryAnalysis.js   # Recovery analysis
│   ├── LoadingSpinner.js     # Loading components
│   └── ErrorMessage.js       # Error handling
├── pages/               # Strony aplikacji
│   ├── Dashboard.js     # Main dashboard
│   ├── Analytics.js     # Advanced analytics
│   ├── Predictions.js   # Predictions
│   ├── Sleep.js         # Sleep analysis
│   ├── Stress.js        # Stress analysis
│   ├── Activity.js      # Activity analysis
│   ├── Insights.js      # Personalized insights
│   └── Settings.js      # Settings
├── context/             # Context API
│   └── HealthDateContext.js  # State management
├── services/            # API services
│   └── api.js          # Configuration i endpointy API
└── App.js              # Main application component
```

## 🎯 Key features

### 1. Real-time Analytics
- Automatic data refresh
- Live updates of health metrics
- Progressive data loading

### 2. AI-Powered Insights
- Machine learning korelacje
- Automatic pattern detection
- Predykcyjne analizy zdrowotne

### 3. Personalizacja
- Dostosowane rekomendacje
- Konfigurowalne okresy analizy
- Personalizowane dashboardy

### 4. Zaawansowane wizualizacje
- Interaktywne wykresy
- Macierze korelacji
- Radar charts for patterns
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
- Error boundaries for components
- Performance monitoring

### Developer tools
- React Developer Tools
- Redux DevTools (if used)
- Network tab for API calls

## 📈 Performance

### Optimizations
- Lazy loading of components
- Memoization for heavy computations
- Virtualization for large lists
- Code splitting

### Metrics
- First Contentful Paint < 2s
- Time to Interactive < 3s
- Lighthouse Score > 90

## 🤝 Contributing

1. Fork repository
2. Create a feature branch
3. Commit changes
4. Push to branch
5. Create a Pull Request

## 📄 License

MIT License - see the LICENSE file for details.

---

**Created by**: Enhanced Analytics System v1.0  
**Date**: 2024-01-14  
**Status**: ✅ Ready for production