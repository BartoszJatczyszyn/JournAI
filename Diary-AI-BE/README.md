# Diary AI Backend (Clean Architecture)

This backend is organized by Clean Architecture layers:

- domain: Business rules and protocols (interfaces)
- application: Use cases (stateless services orchestrating repos and analytics)
- infrastructure: Adapters (Postgres repositories, db helpers)
- presentation: FastAPI routers and thin controllers, DI helpers

Key entrypoints:
- app/backend_api_enhanced.py – starts FastAPI, mounts routers from `presentation/routers`

Compatibility shims:
- app/services/* and app/repositories/* re-export application services and infrastructure repos to avoid breaking existing imports. New code should import from `application.services.*` and `infrastructure.repositories.*`.

Notes:
- Settings live in `app/settings.py`
- Database helpers in `app/db.py`
- Pydantic schemas in `app/schemas/*`
