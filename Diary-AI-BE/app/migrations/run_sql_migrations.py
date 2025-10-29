#!/usr/bin/env python3
from __future__ import annotations

"""
Apply timestamped .sql migrations in app/migrations inside the backend container.

Rules:
- Only files starting with a 4-digit year are considered (e.g., 20251025_*.sql)
- Files are applied in sorted order with a small override to ensure
  'migrate_strength_to_garmin' runs before 'drop_workout_sessions' if both exist.
- Each file is executed as-is in a single cursor.execute; SQL should be idempotent
  or use IF EXISTS/IF NOT EXISTS where possible.
"""

import sys
from pathlib import Path
from typing import List

from app.db import get_connection


def list_sql_files() -> List[Path]:
    here = Path(__file__).parent
    files = [p for p in here.glob("*.sql") if p.name[:4].isdigit()]
    files.sort(key=lambda p: p.name)
    # Ensure drop_workout_sessions runs after migrate_strength_to_garmin on same day
    def priority(p: Path) -> int:
        name = p.name.lower()
        if "drop_workout_sessions" in name:
            return 2
        if "migrate_strength_to_garmin" in name:
            return 1
        return 0
    files = sorted(files, key=lambda p: (p.name[:8], priority(p), p.name))
    return files


def apply_file(path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    with get_connection() as conn:  # type: ignore
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(sql)
            conn.commit()


def main() -> None:
    files = list_sql_files()
    if not files:
        print("No timestamped SQL migrations found.")
        return
    print("Applying SQL migrations:")
    for f in files:
        print(f" - {f.name}")
        try:
            apply_file(f)
        except Exception as e:
            print(f"Error applying {f.name}: {e}", file=sys.stderr)
            raise
    print("✅ SQL migrations applied")


if __name__ == "__main__":
    main()
