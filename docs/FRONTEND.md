# FRONTEND (React Dashboard)

Optional modern dashboard for visual exploration. Not required for analytics API.

## Capabilities
- Summary dashboard (key metrics + quick trends)
- Enhanced analytics visualizations (correlations matrix, clusters, temporal patterns)
- Recovery & predictions panels
- Sleep / Stress / Activity deep pages
- Dark / light theme auto + manual toggle

## Tech Stack
| Layer | Choice |
|-------|--------|
| Framework | React + Vite / CRA (depending on current scaffold) |
| Charts | Recharts (interactive) |
| State | Local state + lightweight context |
| Styling | Minimal custom + utility classes |

## Setup
```bash
cd Diary-AI-FE/frontend-react
npm install
npm start
```
Proxy points to backend `http://localhost:5002` (adjust via `.env`):
```
REACT_APP_API_URL=http://localhost:5002
```

## Build Production
```bash
npm run build
# serve dist:
npm install -g serve
serve -s build -l 3000
```

## Structure (Simplified)
```
src/
  components/
  pages/
  services/api.js
  context/
  App.js
```

## API Integration Patterns
- All requests go through `services/api.js`
- Error boundaries & toast notifications on failure
- Retry strategy for transient network errors (extendable)

## Adding a New Panel
1. Add endpoint in backend (router)
2. Create fetch helper in `api.js`
3. Add component under `components/` or `pages/`
4. Wire route / navigation

## Performance Tips
- Lazy load heavy pages (`React.lazy`)
- Memoize derived datasets
- Avoid re-render storms: lift state carefully

## Theming
- Detects `prefers-color-scheme`
- Saves user override to `localStorage`

## Roadmap Ideas
- Offline cache (IndexedDB)
- Progressive Web App mode
- Drag & drop customizable dashboard grid

---
Frontend optional—skip entirely if you only need programmatic access.
