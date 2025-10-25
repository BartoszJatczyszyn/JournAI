# Clean Architecture: Project Layout

This backend follows a pragmatic Clean Architecture to keep business logic independent from frameworks and I/O details.

- domain/ — Enterprise business rules
  - entities, value objects (if any), and repository interfaces (Protocols)
  - e.g. `domain/repositories/*.py` interface contracts
- application/ — Use cases and orchestration
  - services coordinate domain logic via repository interfaces
  - no direct imports from infrastructure/frameworks
- infrastructure/ — Implementations for I/O
  - DB access, analytics engines, concrete repositories (Postgres)
  - may depend on `app.db` helpers
- presentation/ — Delivery mechanisms (FastAPI routers/controllers, DI)
  - maps HTTP <-> application, no DB access
- lib/ — Cross-cutting utilities (caching, errors)
- migrations/ — SQL and scripts to evolve storage

## Dependency rules

- presentation -> application -> domain
- infrastructure implements domain interfaces; application depends on those interfaces only
- No layer depends inward on a more outer layer (e.g., domain must never import from application)

## DI and wiring

- `presentation/di.py` constructs services and injects repositories.
- Services now accept repository interfaces (domain Protocols) instead of creating concrete repos internally.

## Recent cosmetic changes

- application/services now depend on domain Protocols for activities, sleeps, weight, and gym.
- HTTP helpers moved to `presentation/http.py` (root `app/http_helpers.py` keeps a thin shim for BC).
- Use DI (`presentation.di.di`) to obtain services in routers instead of instantiating directly.

## Next steps (optional)

- Gradually remove direct `from db import ...` usage from application services by introducing repository methods.
- Add import-linter rules to enforce dependencies via a `.importlinter` config.
- Add unit tests around services using in-memory or stub repositories.
