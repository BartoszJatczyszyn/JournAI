# MIGRATIONS & SCHEMA MANAGEMENT

Covers database evolution, data resets, and safe change practices.

## Philosophy
- Keep personal dataset lean; prefer additive changes
- Avoid destructive drops unless performing a full reset
- Document new fields & integrate into analytics paths deliberately

## Migration Entry Points
| Script | Purpose |
|--------|---------|
| `run_migration.py` | Primary migration orchestrator |
| `setup_migration.py` | Initial environment / prerequisite checks |
| Archive scripts | Historical (reference only) |

## Typical Flow
```bash
docker compose up -d db
python Diary-AI-BE/run_migration.py
```
Validate:
```bash
docker exec -it db psql -U diary_user -d diary -c "\dt"
```

## Adding a Column
1. Create new migration step (SQL or Python executing SQL)
2. Backfill null-safe defaults if needed
3. Expose field in dataset builders used by analytics engine
4. Update docs & (optionally) add test

## Full Reset Use Cases
| Case | Justify Reset? | Notes |
|------|----------------|------|
| Major schema redesign | Yes | Faster than incremental retrofits |
| Corrupted volume | Yes | Start clean |
| Experiment sandbox | Optional | Use fresh branch / separate DB |

Run:
```bash
./full_reset.sh
```

## Data Preservation Strategy
Before destructive reset:
```bash
pg_dump -h localhost -U diary_user diary > backup_pre_reset.sql
```
Store in timestamped folder (e.g. `backups/2025-10-01/`).

## Journal Integrity
Enforce uniqueness per `day` (if implemented) to avoid duplicates. Decide on upsert or last-write-wins semantics.

## Evolving Analytics
When metrics added:
- Re-run correlation / cluster docs examples to ensure stable outputs
- Validate no division by zero / empty arrays

## Safety Checklist (Before Commit)
- [ ] No raw destructive SQL left uncommented
- [ ] New columns documented
- [ ] Scripts idempotent (safe re-run)
- [ ] Tested on sample dataset (10–30 days)

## Future Enhancements
- Lightweight Alembic integration (optional)
- Structured migration manifest file
- Automated schema diff summary in CI

---
Questions about a specific migration step? Add a note or open an issue.
