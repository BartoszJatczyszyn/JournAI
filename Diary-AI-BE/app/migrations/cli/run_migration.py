#!/usr/bin/env python3
"""
CLI: Run the enhanced Garmin data migration (new location).

Usage:
  python -m app.migrations.cli.run_migration [--subset daily|sleep|rhr|stress|hr|rr|activities|weight|journal|all]
"""
from __future__ import annotations

import argparse
from typing import Callable

from app.migrations.enhanced_migration import EnhancedGarminMigrator


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
