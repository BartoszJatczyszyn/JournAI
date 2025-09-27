#!/usr/bin/env python3
"""Compatibility shim for backfill_daily_journal.
"""
from migrations.backfill_daily_journal import *  # noqa: F401,F403

try:
    from migrations.backfill_daily_journal import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
