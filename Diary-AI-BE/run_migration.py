#!/usr/bin/env python3
"""
Legacy wrapper for migration CLI.

New location: app/migrations/cli/run_migration.py
Usage (preferred):
  python -m app.migrations.cli.run_migration [--subset ...]
"""
from __future__ import annotations

from app.migrations.cli.run_migration import main


if __name__ == "__main__":
    print("ℹ️  Using legacy entrypoint. Prefer: python -m app.migrations.cli.run_migration")
    main()
