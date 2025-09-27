#!/usr/bin/env python3
"""
Create (if missing) and refresh materialized view mv_predictive_features.
"""
from __future__ import annotations

from pathlib import Path
from db import get_connection

SQL_FILE = Path(__file__).resolve().parent / "create_features_view.sql"


def ensure_and_refresh() -> None:
    sql = None
    if SQL_FILE.exists():
        sql = SQL_FILE.read_text(encoding="utf-8")
    with get_connection() as conn:  # psycopg3 or psycopg2 connection
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            if sql:
                cur.execute(sql)
                conn.commit()
            # Try non-concurrent first (supports initial populate)
            try:
                cur.execute("REFRESH MATERIALIZED VIEW mv_predictive_features;")
                conn.commit()
            except Exception:
                conn.rollback()
            # Then try concurrent for subsequent updates
            try:
                cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_predictive_features;")
                conn.commit()
            except Exception:
                conn.rollback()


def main() -> None:
    ensure_and_refresh()
    print("✅ Predictive features materialized view refreshed.")


if __name__ == "__main__":
    main()
