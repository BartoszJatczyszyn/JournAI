#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from app.db import execute_query, get_connection


def apply_sql(path: Path) -> None:
    sql = path.read_text(encoding='utf-8')
    # execute raw SQL; split on semicolons carefully could break functions; just use one execute
    with get_connection() as conn:  # type: ignore
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(sql)
            conn.commit()


def main() -> None:
    here = Path(__file__).parent
    sql_file = here / 'create_strength_tables.sql'
    # Ensure required extensions (pg_trgm for GIN trigram index on exercise names)
    with get_connection() as conn:  # type: ignore
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
            conn.commit()
    apply_sql(sql_file)
    # seed data
    from app.migrations.seed_strength_data import main as seed
    seed()
    print('✅ Strength tables created and seeded')


if __name__ == '__main__':
    main()
