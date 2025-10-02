# API Quick Reference

Base URL: http://localhost:5002/api
Docs: http://localhost:5002/api/docs

System
- GET /health — liveness check
- GET /analytics/info — capabilities overview

Core
- GET /stats — dataset overview
- GET /health-data?days=30 — recent daily metrics

Sleeps
- GET /sleeps/latest?limit=20&offset=0&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
- GET /sleeps/{sleep_id}

Activities
- GET /activities/latest?limit=20
- GET /activities/{activity_id}

Trends & Insights
- GET /trends/health?days=90
- GET /insights/personalized?days=60
- GET /insights/optimization?metric=sleep_quality&days=60

Predictions
- GET /predictions/energy?days_ahead=7
- GET /predictions/sleep?days_ahead=7
- GET /predictions/mood?days_ahead=7
- GET /predictions/comprehensive?days_ahead=7

Weight
- GET /weight/current
- GET /weight/history?days=90
- GET /weight/stats
- GET /weight/correlations?days=90&min_abs=0.2

Admin
- POST /admin/models/retrain
  Body: { "models": ["energy", "sleep", "mood"] } (optional)

Notes
- All endpoints return JSON. Many include ISO-formatted dates.
- For exhaustive schemas, consult the Swagger UI at `/api/docs`.
- Rate limits: none in dev; be kind to your CPU.
