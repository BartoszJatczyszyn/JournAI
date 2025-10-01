# DATA PIPELINE

End-to-end path from raw Garmin export / API pull to analytics-ready aggregates.

## Stages
| Stage | Tool / Script | Output |
|-------|---------------|--------|
| Raw Acquisition | `garmindb` CLI | Local SQLite + JSON blobs |
| Migration | migration scripts in `Diary-AI-BE/` | PostgreSQL normalized tables |
| Enrichment | enhanced analytics engine | Derived views / in-memory transforms |
| Journal Augmentation | `journal_cli.py` | Additional subjective metrics |
| Analytics Consumption | FastAPI endpoints | JSON responses / UI panels |

## Core Tables (Representative)
| Table | Purpose |
|-------|---------|
| `garmin_daily_summaries` | Steps, calories, resting HR, etc. |
| `garmin_sleep_sessions` | Sleep score, duration, timing |
| `garmin_weight` | Body weight history |
| `daily_journal` | Mood, supplements, sleep environment, notes |

## Derived Metrics
- `time_in_bed_minutes` (sleep)
- Recovery composite indices
- Normalized z-scores per domain (internal use)

## Journal Model (Selected Fields)
| Field | Type | Notes |
|-------|------|------|
| mood | enum(text) | terrible → great scale |
| energy_level | int? | Optional numeric scale |
| supplement_ashwagandha | bool | Experiment correlation |
| sleep_mask | bool | Sleep condition |
| meditated | bool | Habit tracking |
| notes | text | Freeform observations |

## Migration Flow
1. Ensure Postgres running
2. Run `run_migration.py` (or orchestrated script)
3. Verify tables exist (`\dt` inside psql) / or via a test query
4. Optionally seed journal backfill script if retroactive entries desired

## Reset Strategy
Use `./full_reset.sh` for schema-breaking changes. It:
1. Stops & removes containers & volume
2. Rebuilds images
3. Applies migrations fresh
4. (Optionally) kicks off data import

## Data Quality Considerations
| Issue | Mitigation |
|-------|-----------|
| Missing days | Leave gaps (models skip gracefully) |
| Outliers (extreme steps) | Potential future clipping / flagging |
| Duplicate journal entries | Last write wins (or enforce unique constraint) |
| Timezone drift | Favor storing dates in UTC / canonical day boundary |

## Extending Schema
1. Add column via migration script
2. Re-run migrations (or design incremental migration)
3. Map new field into comprehensive dataset builder
4. Adjust analytics to include new metric where meaningful

## Backups
```bash
# Full Postgres dump
pg_dump -h localhost -U diary_user diary > backup.sql
```
Automate with cron for daily retention (rotate old dumps).

---
For advanced ETL (e.g. warehousing), build external exporter hitting analytics endpoints or raw tables.
