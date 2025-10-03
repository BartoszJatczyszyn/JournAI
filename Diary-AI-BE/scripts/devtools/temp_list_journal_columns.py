#!/usr/bin/env python3
"""List daily_journal columns (devtool)."""
from db import get_connection


def main():
    with get_connection() as conn:  # type: ignore[assignment]
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='daily_journal' ORDER BY 1")
            cols = [r[0] for r in cur.fetchall()]
            for c in cols:
                print(c)


if __name__ == '__main__':
    main()
