"""CLI helper to add/update HRV (ms) values in daily_journal.

Usage examples:
  python -m scripts.add_or_update_hrv_ms 2025-09-20 72.5
  python -m scripts.add_or_update_hrv_ms 2025-09-18 68

If the row exists it updates hrv_ms, otherwise it creates a stub daily_journal row (with only day + hrv_ms).
"""
from __future__ import annotations

import os
import sys
from datetime import date

# Try psycopg (v3) first, then fallback to psycopg2 for older envs
try:  # pragma: no cover - import resolution depends on environment
    import psycopg
    _PSYCOPG_VER = 3
except Exception:  # pragma: no cover
    psycopg = None  # type: ignore
    try:
        import psycopg2  # type: ignore
        _PSYCOPG_VER = 2
    except Exception as _e:  # pragma: no cover
        psycopg2 = None  # type: ignore
        _PSYCOPG_VER = 0


def get_conn():
    """Return a DB connection using whichever psycopg driver is available.
    Supports:
      - psycopg (v3) : psycopg.connect(dsn)
      - psycopg2 (v2): psycopg2.connect(dsn)
    """
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_DSN")
    if not dsn:
        host = os.environ.get("PGHOST", "localhost")
        user = os.environ.get("PGUSER", "postgres")
        password = os.environ.get("PGPASSWORD", "")
        db = os.environ.get("PGDATABASE", "diary_ai")
        port = os.environ.get("PGPORT", "5432")
        dsn = f"host={host} port={port} user={user} password={password} dbname={db}"
    if _PSYCOPG_VER == 3 and psycopg:  # type: ignore
        return psycopg.connect(dsn)  # type: ignore
    if _PSYCOPG_VER == 2:
        return psycopg2.connect(dsn)  # type: ignore
    print("ERROR: Neither psycopg (v3) nor psycopg2 installed. Install 'psycopg[binary]' or 'psycopg2-binary'.", file=sys.stderr)
    sys.exit(1)


def parse_day(val: str) -> date:
    try:
        return date.fromisoformat(val)
    except ValueError:
        print(f"Invalid date format: {val}. Use YYYY-MM-DD.", file=sys.stderr)
        sys.exit(1)


def parse_hrv(val: str) -> float:
    try:
        f = float(val)
    except ValueError:
        print(f"HRV must be numeric: {val}", file=sys.stderr)
        sys.exit(1)
    if f <= 0 or f > 300:
        print("HRV ms value out of plausible range (0,300].", file=sys.stderr)
        sys.exit(1)
    return f


def upsert_hrv(day_val: date, hrv_ms: float):
    sql = """
    INSERT INTO daily_journal (day, hrv_ms)
    VALUES (%s, %s)
    ON CONFLICT (day) DO UPDATE SET hrv_ms = EXCLUDED.hrv_ms;
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (day_val, hrv_ms))
    print(f"Set hrv_ms={hrv_ms:.2f} for {day_val}")


def main(argv: list[str]):
    if len(argv) != 3:
        print("Usage: python -m scripts.add_or_update_hrv_ms YYYY-MM-DD HRV_MS", file=sys.stderr)
        return 2
    day_val = parse_day(argv[1])
    hrv_val = parse_hrv(argv[2])
    upsert_hrv(day_val, hrv_val)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv))
