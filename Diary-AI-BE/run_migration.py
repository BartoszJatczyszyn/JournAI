#!/usr/bin/env python3
"""
Run the enhanced Garmin data migration.

Usage:
  python run_migration.py [--subset daily|sleep|rhr|stress|hr|rr|activities|weight|journal|all]

If no subset provided, runs the full migration.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Callable

# Ensure this file's directory (project root: AI/) is on sys.path so imports work from anywhere
_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))


def _ensure_db_driver_env() -> None:
    """Set DB_DRIVER env var automatically based on available drivers to prevent runtime failures.
    Prefers psycopg (v3). Falls back to psycopg2 if only that one is installed.
    """
    if os.getenv("DB_DRIVER"):
        return
    try:
        import psycopg  # type: ignore
        os.environ["DB_DRIVER"] = "psycopg"
    except Exception:
        try:
            import psycopg2  # type: ignore
            os.environ["DB_DRIVER"] = "psycopg2"
        except Exception:
            # Leave unset; SQLAlchemy will try psycopg by default and fail with a clear error
            pass


def _check_dependencies() -> None:
    """Give a helpful message if required dependencies are missing."""
    try:
        import sqlalchemy  # noqa: F401
    except Exception:
        print("❌ Missing dependency: SQLAlchemy.\n   Please run: python setup_migration.py\n   or: pip install -r requirements.txt (in the AI/ directory)")
        raise
    # Ensure at least one PG driver is available
    try:
        import psycopg  # type: ignore  # noqa: F401
    except Exception:
        try:
            import psycopg2  # type: ignore  # noqa: F401
        except Exception:
            print(
                "❌ Missing PostgreSQL driver (psycopg or psycopg2).\n"
                "   Run: python setup_migration.py\n"
                "   or: pip install -r requirements.txt (in the AI/ directory)"
            )
            raise


# Prepare environment before importing migrator
_ensure_db_driver_env()
_check_dependencies()

from scripts.enhanced_migration import EnhancedGarminMigrator  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run Garmin migration")
    p.add_argument(
        "--subset",
        choices=[
            "all",
            "daily",
            "sleep",
            "rhr",
            "stress",
            "hr",
            "rr",
            "activities",
            "weight",
            "journal",
            "stats",
        ],
        default="all",
        help="Run only a specific subset of the migration",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    m = EnhancedGarminMigrator()

    if args.subset == "all":
        m.run_migration()
        return

    # Map subset to specific methods
    actions: dict[str, Callable[[], None]] = {
        "daily": m.migrate_daily_summary_data,
        "sleep": m.migrate_sleep_data,
        "rhr": m.migrate_rhr_data,
        "stress": m.migrate_stress_data,
        "hr": m.migrate_heart_rate_data,
        "rr": m.migrate_respiratory_rate_data,
        "activities": m.migrate_activities_data,
        "weight": m.migrate_weight_data,
        "journal": m.create_journal_entries,
        "stats": m.compute_minute_level_daily_stats,
    }

    action = actions.get(args.subset)
    if action is None:
        raise SystemExit(f"Unknown subset: {args.subset}")

    print(f"➡️ Running subset: {args.subset}")
    action()
    print("✅ Done.")


if __name__ == "__main__":
    main()
