#!/usr/bin/env python3
"""Compatibility shim for migrate_sleep_events_sqlite_to_postgres.
"""
from migrations.migrate_sleep_events_sqlite_to_postgres import *  # noqa: F401,F403

try:
    from migrations.migrate_sleep_events_sqlite_to_postgres import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
