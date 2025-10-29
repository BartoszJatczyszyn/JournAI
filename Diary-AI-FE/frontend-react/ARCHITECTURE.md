# Frontend Clean Architecture

This project is organized using a frontend-friendly adaptation of Clean Architecture with feature-sliced structure. The goal is to keep domain logic close to the feature, isolate infrastructure concerns, and enable safe refactors.

## Layers

- app: Application-wide setup (providers, routing wrappers, styles)
- entities: Domain entities (models, normalizers, mappers)
- features: User-facing features, encapsulating UI + hooks + model + API facades
- widgets: Higher-level composite UI that composes features/entities
- shared: Reusable UI components and libs without domain knowledge
- infrastructure: External services (API clients, adapters)

## Folder structure

src/
- app/
  - providers/
- entities/
  - <entity>/
    - model.ts/js
- features/
  - <feature>/
    - pages/
    - components/
    - hooks/
    - model/
    - api/
- widgets/
  - charts/
  - insights/
- shared/
  - ui/
  - lib/
- infrastructure/
  - api/

## Migration guidelines

- New code should live under features/<feature>.
- Each feature exposes a thin API facade that wraps infrastructure/api and returns feature/domain-shaped models.
- Use entities/<entity> for reusable domain models and mappers.
- Widgets are reusable composites that can be shared across features.
- Keep shared/ui generic and style-agnostic where possible.
- Infrastructure should not be imported directly from pages or dumb components; use feature facades.

## Sleep feature example

- features/sleep/pages: Sleep pages routed by the App
- features/sleep/components: Sleep-specific components
- features/sleep/hooks: Sleep-specific hooks
- features/sleep/api: Facade to infrastructure/api/sleeps
- entities/sleep: Model + mappers for sleep domain

Compatibility proxies have been left in src/pages, src/components/sleep, src/hooks to avoid breaking imports. Gradually migrate consumers to import from features/sleep/*.
