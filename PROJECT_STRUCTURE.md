# Project Structure (AI)

This project has been organized for clarity and maintainability. The key directories and their responsibilities are:

- scripts/
  - analytics/: Advanced analytics engines and utilities
    - enhanced_analytics_engine.py
    - specialized_analytics.py
    - predictive_analytics.py
    - model_utils.py
  - migrations/: Database migration and data maintenance tools
    - enhanced_migration.py
    - backfill_daily_journal.py
    - update_last_sleep_phase.py
    - migrate_sleep_events_sqlite_to_postgres.py
    - create_features_view.sql
    - refresh_features_view.py
  - cli/: Command-line tools for interacting with the system
    - data_manager.py
    - journal_cli.py
  - services/: Service-layer modules used by the Flask backend
    - health_service.py
    - journal_service.py
    - trends_service.py
  - blueprints/: Flask blueprints (routing layer)
    - analytics.py
    - predictions.py
    - insights.py
  - backend_api_enhanced.py: Flask app factory and blueprint registration
  - start_enhanced_backend.py: Startup script with checks and auto-install
  - db.py, http_helpers.py, utils.py: Shared utilities

- Diary-AI-FE/frontend-react/: React UI for the dashboard
- docs/: Documentation
- README.md, QUICK_START.md: Getting started guides
- Diary-AI-BE/config.env(.example): Environment configuration
- start_all.sh, stop_all.sh: Convenience scripts to run/stop the whole stack

Compatibility shims were added in Diary-AI-BE/scripts/ so existing paths continue to work:
- scripts/enhanced_analytics_engine.py -> analytics/enhanced_analytics_engine.py
- scripts/specialized_analytics.py -> analytics/specialized_analytics.py
- scripts/predictive_analytics.py -> analytics/predictive_analytics.py
- scripts/model_utils.py -> analytics/model_utils.py
- scripts/enhanced_migration.py -> migrations/enhanced_migration.py
- scripts/backfill_daily_journal.py -> migrations/backfill_daily_journal.py
- scripts/update_last_sleep_phase.py -> migrations/update_last_sleep_phase.py
- scripts/migrate_sleep_events_sqlite_to_postgres.py -> migrations/migrate_sleep_events_sqlite_to_postgres.py
- scripts/refresh_features_view.py -> migrations/refresh_features_view.py
- scripts/journal_cli.py -> cli/journal_cli.py
- scripts/data_manager.py -> cli/data_manager.py

No external commands or documentation references were broken; existing examples like
`cd Diary-AI-BE/scripts && python start_enhanced_backend.py` and `cd Diary-AI-BE/scripts && python enhanced_analytics_engine.py`
still work. Internally, imports continue to function via lightweight re-export modules.

## Notes
- .gitignore updated to include Diary-AI-BE/scripts/analytics/models/*.joblib
- scripts/__init__.py added to ensure reliable package imports
