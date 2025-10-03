#!/usr/bin/env python3
"""Quick check of recent daily_journal rows (devtool)."""
from datetime import date, timedelta
from db import get_connection


def main():
    start = date.today() - timedelta(days=10)
    with get_connection() as conn:  # type: ignore[assignment]
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(
                "SELECT day, mood, hrv_ms, energy_level, sleep_quality_manual, stress_level_manual, productivity_level FROM daily_journal WHERE day >= %s ORDER BY day LIMIT 15",
                (start,),
            )
            rows = cur.fetchall()
            cols = [d.name for d in cur.description]  # type: ignore[attr-defined]
            out = [dict(zip(cols, r)) for r in rows]
            for r in out:
                print(r)


if __name__ == "__main__":
    main()
