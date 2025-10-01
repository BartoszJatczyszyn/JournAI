# API REFERENCE

All endpoints are prefixed with `/api` in the running service.

OpenAPI docs: `GET /docs` (interactive) or `/openapi.json`.

## Health & Meta
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/stats | Basic service + data stats |

## Enhanced Analytics
| Method | Path | Query Params | Notes |
|--------|------|--------------|-------|
| GET | /api/analytics/enhanced/comprehensive | days (int, default 90) | Bundles multiple analyses |
| GET | /api/analytics/enhanced/correlations | days (int) | Pearson/Spearman + significance |
| GET | /api/analytics/enhanced/clusters | days, clusters (2–15) | K-means cluster metadata |
| GET | /api/analytics/enhanced/temporal-patterns | days | Day-of-week & trend |
| GET | /api/analytics/enhanced/recovery | days, compare(bool), start_date, end_date | Recovery + optional comparison |

## Specialized Analytics
| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | /api/analytics/sleep/comprehensive | days (default 30) | Sleep efficiency & timing |
| GET | /api/analytics/stress/comprehensive | days (default 30) | Stress pattern analysis |
| GET | /api/analytics/activity/comprehensive | days (default 30) | Activity intensity & consistency |

## Period Comparison & Legacy Correlations
| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | /api/analytics/correlations | (none) | Raw historical correlation table (journal + core metrics) |
| GET | /api/analytics/compare/periods | period1_days, period2_days, offset_days | Compare two windows |

## Predictions
| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | /api/predictions/energy | days_ahead (default 7) | Energy forecast |
| GET | /api/predictions/sleep | days_ahead | Sleep score forecast |
| GET | /api/predictions/mood | days_ahead | Mood forecast |
| GET | /api/predictions/comprehensive | days_ahead | All prediction bundles |

## Insights
| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | /api/insights/personalized | days (default 90) | Personalized pattern insights |
| GET | /api/insights/optimization | days (default 60), metric (optional) | Optimization guidance |

## Trends
| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | /api/trends/health | days (default 90) | Health composite trend assessment |

## Response Conventions
Common envelope (typical analytics endpoints):
```json
{
  "status": "success",
  "analysis_type": "enhanced_correlations",
  "period_days": 90,
  "timestamp": "2025-10-01T10:22:11.123456",
  "<payload-specific>": {}
}
```
Errors (standardized via helper):
```json
{
  "status": "error",
  "error": "human_readable_message"
}
```
HTTP codes: 200 OK, 400 validation/parameter, 404 no data, 500 unhandled.

## Examples
```bash
curl "http://localhost:5002/api/analytics/enhanced/correlations?days=60"
curl "http://localhost:5002/api/analytics/enhanced/clusters?days=120&clusters=4"
curl "http://localhost:5002/api/analytics/enhanced/recovery?days=90&compare=true"
```

## Rate & Performance Notes
- Intended for personal use (no aggressive rate limiting by default)
- Clustering & correlations scale with rows × features (small locally)
- Add caching layer (future) if re-running large windows frequently

## Versioning Strategy
- Breaking changes: bump minor version (document in CHANGELOG pending)
- Additive fields: backward compatible
- Deprecated endpoints kept behind stable paths until replaced

---
Need an endpoint not listed? Open an issue or extend a router in `scripts/blueprints/`.
