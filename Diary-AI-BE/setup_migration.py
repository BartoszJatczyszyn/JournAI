#!/usr/bin/env python3
"""
Legacy wrapper for migration setup CLI.

New location: app/migrations/cli/setup_migration.py
Usage (preferred):
  python -m app.migrations.cli.setup_migration
"""
from __future__ import annotations

from app.migrations.cli.setup_migration import main


if __name__ == "__main__":
    print("ℹ️  Using legacy entrypoint. Prefer: python -m app.migrations.cli.setup_migration")
    main()
