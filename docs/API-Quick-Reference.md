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

## Strength (GYM)

Base: /api/strength

- GET /muscle-groups
- GET /exercises?query=&muscleGroupId=

Workouts (backed by Garmin activities with sub_sport = strength_training)
- GET /workouts?limit=50&offset=0&userId= — lists Garmin activities (strength_training)
- GET /workouts/{workout_id} — treats id as Garmin activity_id; returns attached strength logs
- POST /workouts — attach logs to an existing Garmin activity
  Body: { activityId, exercises: [ { exerciseDefinitionId, order?, notes?, sets: [ { setNumber, reps, weight, rpe?, isWarmup? } ] } ] }
  Notes: activityId is required; creation of Garmin activities is out of scope.
- PUT /workouts/{workout_id} — replaces logs/sets for the Garmin activity
  Body: { exercises: [...] } (other fields ignored)
- DELETE /workouts/{workout_id} — removes attached strength logs (does not delete the Garmin activity)

Templates
- GET /templates
- POST /templates
- DELETE /templates/{tpl_id}

Analytics
- GET /exercises/{exercise_id}/stats — per-session volume and best e1RM
- GET /exercises/{exercise_id}/history — recent logs with sets
- GET /analytics/exercises/{exercise_id}/e1rm — time series of best e1RM by day
- GET /analytics/overview?days=90&userId= — total session volume by day
 - GET /analytics/exercises/{exercise_id}/summary?days=180&userId= — summary: { points, slope, r2, lastPR, lastPRDate }
 - GET /analytics/top-progress?days=90&limit=5&userId= — top exercises by positive slope (trend), with { exerciseId, name, slope, r2, lastPR, lastPRDate, points }
