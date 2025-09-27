#!/usr/bin/env python3
"""
Populate `garmin_sleep_sessions.last_sleep_phase` from `garmin_sleep_events`.

For each date (date(timestamp)) in garmin_sleep_events, find the event row with
the latest timestamp and write its `event` value into the corresponding
garmin_sleep_sessions.row where day = that date.

Usage:
  python scripts/update_last_sleep_phase.py            # update all days
  python scripts/update_last_sleep_phase.py --date 2025-08-04

This script will create the `last_sleep_phase` column on garmin_sleep_sessions
if it does not already exist.
"""
from __future__ import annotations

import argparse
from typing import Optional
import sys

from db import execute_query, get_connection


def ensure_column_exists() -> bool:
    # Check information_schema for column existence
    q = """
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'garmin_sleep_sessions' AND column_name = 'last_sleep_phase'
    """
    rows = execute_query(q)
    if rows is None:
        print('Failed to query information_schema for columns')
        return False
    if len(rows) == 0:
        print('Adding column last_sleep_phase to garmin_sleep_sessions')
        alter = "ALTER TABLE garmin_sleep_sessions ADD COLUMN last_sleep_phase TEXT;"
        ok = execute_query(alter, None, fetch_all=False, fetch_one=False)
        if ok is None:
            print('Failed to add column last_sleep_phase', file=sys.stderr)
            return False
        return True
    print('Column last_sleep_phase already exists')
    return True


def fetch_latest_event_per_day(target_day: Optional[str] = None):
    # Build query that finds for each date the event with the max(timestamp)
    params = []
    date_filter = ''
    if target_day:
        date_filter = "WHERE date(timestamp) = %s"
        params.append(target_day)

    q = f"""
    WITH latest_per_day AS (
      SELECT date(timestamp) AS day, max(timestamp) AS maxt
      FROM garmin_sleep_events
      {date_filter}
      GROUP BY date(timestamp)
    )
    SELECT l.day AS day, e.event AS event, e.timestamp AS ts
    FROM latest_per_day l
    JOIN garmin_sleep_events e
      ON date(e.timestamp) = l.day AND e.timestamp = l.maxt
    ORDER BY l.day DESC
    """
    rows = execute_query(q, tuple(params) if params else None)
    return rows or []


def update_sessions(days_events):
    updated = 0
    for r in days_events:
        day = r.get('day')
        event = r.get('event')
        if not day:
            continue
        # Update the session for that day (if exists)
        u = "UPDATE garmin_sleep_sessions SET last_sleep_phase = %s WHERE day = %s"
        res = execute_query(u, (event, day), fetch_all=False, fetch_one=False)
        if res is None:
            print(f'Failed to update day {day} -> {event}', file=sys.stderr)
        else:
            updated += 1
    return updated


def main():
    p = argparse.ArgumentParser(description='Populate last_sleep_phase from sleep events')
    p.add_argument('--date', help='Target date (YYYY-MM-DD) to update only that day')
    args = p.parse_args()

    ok = ensure_column_exists()
    if not ok:
        print('Column check/creation failed; aborting', file=sys.stderr)
        sys.exit(2)

    rows = fetch_latest_event_per_day(args.date)
    if not rows:
        print('No sleep events found for given constraints')
        sys.exit(0)

    print(f'Found {len(rows)} latest-event rows to apply')
    applied = update_sessions(rows)
    print(f'Updated {applied} garmin_sleep_sessions rows')


if __name__ == '__main__':
    main()
