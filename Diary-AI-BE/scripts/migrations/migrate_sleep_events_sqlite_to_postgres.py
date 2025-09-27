#!/usr/bin/env python3
"""
Migrate sleep_events table from a local SQLite database (garmin.db) to PostgreSQL
by creating/refreshing a target table named garmin_sleep_events.

Usage:
  python AI/scripts/migrate_sleep_events_sqlite_to_postgres.py \
      --sqlite /Users/you/HealthData/DBs/garmin.db \
      [--sqlite-table sleep_events] \
      [--truncate]

Postgres connection:
  Uses environment variables or config.env defaults:
    DB_HOST (default: localhost)
    DB_PORT (default: 5432)
    DB_NAME (default: diary)
    DB_USER (default: diary_user)
    DB_PASSWORD (default: diary123)

Notes:
- The script expects the SQLite table to have at least columns: timestamp, event, duration.
- duration is converted to PostgreSQL INTERVAL using Python timedelta.
- The target table in Postgres is garmin_sleep_events, with columns:
    timestamp TIMESTAMP WITHOUT TIME ZONE,
    event TEXT,
    duration INTERVAL
- A simple index on timestamp is created for performance.
"""
import argparse
import os
import re
import sqlite3
from datetime import timedelta, datetime

import psycopg

from dotenv import load_dotenv

load_dotenv('config.env')


def parse_args():
    p = argparse.ArgumentParser(description='Migrate sleep events from SQLite to Postgres')
    p.add_argument('--sqlite', required=True, help='Path to SQLite database file (garmin.db)')
    p.add_argument('--sqlite-table', default='sleep_events', help='Source table name in SQLite (default: sleep_events)')
    p.add_argument('--truncate', action='store_true', help='Truncate target table before importing')
    return p.parse_args()


def to_timedelta(val):
    """Convert SQLite duration field to timedelta or None.
    Handles:
      - integer/float seconds
      - HH:MM:SS
      - MM:SS
      - 'PTxxS' (ISO8601 seconds), 'PTxxM', 'PTxxHxxMxxS' (best-effort)
    """
    if val is None:
        return None
    # Integer/float seconds
    if isinstance(val, (int, float)):
        try:
            secs = int(val)
            return timedelta(seconds=max(0, secs))
        except Exception:
            pass
    # String parsing
    try:
        s = str(val).strip()
        # Plain seconds string
        if s.isdigit():
            return timedelta(seconds=int(s))
        # TIME like 'HH:MM:SS.ffffff' or 'HH:MM:SS'
        if re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?", s):
            try:
                # Try microseconds-aware
                t = datetime.strptime(s.split('.')[0], "%H:%M:%S").time()
                return timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)
            except Exception:
                parts = s.split(':')
                h, m, sec = int(parts[0]), int(parts[1]), int(parts[2].split('.')[0])
                return timedelta(hours=h, minutes=m, seconds=sec)
        # HH:MM:SS or MM:SS
        if ':' in s:
            parts = s.split(':')
            parts = [int(p) for p in parts]
            if len(parts) == 3:
                h, m, sec = parts
            elif len(parts) == 2:
                h, m, sec = 0, parts[0], parts[1]
            else:
                return None
            return timedelta(hours=h, minutes=m, seconds=sec)
        # ISO8601-like: PTxxHxxMxxS
        m = re.fullmatch(r"P?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s, flags=re.IGNORECASE)
        if m and any(m.groups()):
            h = int(m.group(1) or 0)
            mi = int(m.group(2) or 0)
            se = int(m.group(3) or 0)
            return timedelta(hours=h, minutes=mi, seconds=se)
    except Exception:
        return None
    return None


def ensure_table(conn):
    with conn.cursor() as cur:
        # Create table with TIME duration if not exists
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS garmin_sleep_events (
                timestamp TIMESTAMP WITHOUT TIME ZONE,
                event TEXT,
                duration TIME WITHOUT TIME ZONE
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_gse_timestamp ON garmin_sleep_events(timestamp);")
        # If table exists with INTERVAL, alter to TIME preserving data
        cur.execute(
            """
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = 'garmin_sleep_events' AND column_name = 'duration'
            """
        )
        row = cur.fetchone()
        if row and isinstance(row[0], str) and row[0].lower() == 'interval':
            # Convert INTERVAL to TIME using 00:00:00 + interval (wraps at 24h)
            cur.execute(
                """
                ALTER TABLE garmin_sleep_events
                ALTER COLUMN duration TYPE TIME WITHOUT TIME ZONE
                USING (time '00:00:00' + duration);
                """
            )
    conn.commit()


def migrate(sqlite_path, sqlite_table, truncate):
    # Connect to SQLite
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")
    scon = sqlite3.connect(sqlite_path)
    scon.row_factory = sqlite3.Row

    # Connect to Postgres
    conn = psycopg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '5432')),
        dbname=os.getenv('DB_NAME', 'diary'),
        user=os.getenv('DB_USER', 'diary_user'),
        password=os.getenv('DB_PASSWORD', 'diary123'),
        autocommit=False,
    )

    try:
        ensure_table(conn)
        if truncate:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE garmin_sleep_events;")
            conn.commit()

        # Pull rows from SQLite
        cur_s = scon.cursor()
        cur_s.execute(f"SELECT timestamp, event, duration FROM {sqlite_table} ORDER BY timestamp;")
        rows = cur_s.fetchall()
        total = len(rows)
        print(f"Fetched {total} rows from SQLite table '{sqlite_table}'.")

        # Insert into Postgres in batches
        batch = []
        batch_size = 1000
        inserted = 0
        with conn.cursor() as cur:
            for r in rows:
                ts = r['timestamp']
                ev = r['event']
                dur = to_timedelta(r['duration'])
                batch.append((ts, ev, dur))
                if len(batch) >= batch_size:
                    cur.executemany(
                        "INSERT INTO garmin_sleep_events (timestamp, event, duration) VALUES (%s, %s, %s)",
                        batch
                    )
                    inserted += len(batch)
                    batch.clear()
            if batch:
                # Convert timedelta to TIME text HH:MM:SS for insertion
                batch_time = []
                for ts, ev, dur in batch:
                    if dur is None:
                        batch_time.append((ts, ev, None))
                    else:
                        total_sec = int(dur.total_seconds())
                        h = (total_sec // 3600) % 24
                        m = (total_sec % 3600) // 60
                        s = total_sec % 60
                        batch_time.append((ts, ev, f"{h:02d}:{m:02d}:{s:02d}"))
                cur.executemany(
                    "INSERT INTO garmin_sleep_events (timestamp, event, duration) VALUES (%s, %s, %s)",
                    batch_time
                )
                inserted += len(batch)
        conn.commit()
        print(f"Inserted {inserted} rows into Postgres table 'garmin_sleep_events'.")
    finally:
        try:
            scon.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


def main():
    args = parse_args()
    migrate(args.sqlite, args.sqlite_table, args.truncate)


if __name__ == '__main__':
    main()
