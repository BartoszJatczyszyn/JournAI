#!/usr/bin/env python3
"""
Backfill daily_journal with reasonable defaults derived from Garmin data so
predictive analytics have enough non-null targets and features.

- Ensures a row exists in daily_journal for every day in garmin_daily_summaries
- Fills (when NULL):
  * sleep_quality_manual (1..5) from sleep_score
  * stress_level_manual (1..5) from stress_avg
  * energy_level (1..5) from sleep_quality_manual + steps
  * mood (1..5) from sleep_quality_manual + steps + stress
  * productivity_level (1..5) ~ avg(energy_level, mood)

Heuristics keep values in [1..5] and avoid overwriting any existing user-entered values.

Usage:
  python scripts/backfill_daily_journal.py

Optional flags:
  --dry-run  (prints a summary without modifying rows)
"""
from __future__ import annotations

import argparse
from contextlib import closing

from db import get_connection


BACKFILL_SQL = r"""
-- 1) Ensure journal rows exist for each day
INSERT INTO daily_journal(day)
SELECT ds.day
FROM garmin_daily_summaries ds
ON CONFLICT (day) DO NOTHING;

-- 2) Prepare computed scores from available data
WITH base AS (
  SELECT 
    ds.day,
    ds.steps,
    ds.stress_avg,
    COALESCE(s.sleep_score, 70) AS sleep_score
  FROM garmin_daily_summaries ds
  LEFT JOIN garmin_sleep_sessions s ON s.day = ds.day
), m AS (
  SELECT
    day,
    /* Sleep quality 1..5 mapped from 0..100 */
    CASE
      WHEN sleep_score >= 85 THEN 5
      WHEN sleep_score >= 75 THEN 4
      WHEN sleep_score >= 65 THEN 3
      WHEN sleep_score >= 50 THEN 2
      ELSE 1
    END AS sleep_quality_manual,
    /* Steps score 1..5 */
    CASE
      WHEN steps >= 12000 THEN 5
      WHEN steps >= 9000 THEN 4
      WHEN steps >= 6000 THEN 3
      WHEN steps >= 4000 THEN 2
      ELSE 1
    END AS steps_score,
    /* Stress level manual 1..5 (higher == worse) */
    CASE
      WHEN stress_avg IS NULL THEN NULL
      WHEN stress_avg <= 25 THEN 1
      WHEN stress_avg <= 40 THEN 2
      WHEN stress_avg <= 55 THEN 3
      WHEN stress_avg <= 75 THEN 4
      ELSE 5
    END AS stress_level_manual
  FROM base
), c AS (
  SELECT
    day,
    sleep_quality_manual,
    steps_score,
    stress_level_manual,
    /* Energy prefers sleep(+steps) */
    LEAST(5, GREATEST(1, ROUND(0.6*sleep_quality_manual + 0.4*steps_score))) AS energy_level,
    /* Mood prefers sleep(+steps) but penalizes stress */
    LEAST(5, GREATEST(1, ROUND(0.6*sleep_quality_manual + 0.2*steps_score + 0.2*(5-COALESCE(stress_level_manual,3))))) AS mood
  FROM m
), c2 AS (
  SELECT
    day,
    sleep_quality_manual,
    stress_level_manual,
    energy_level,
    mood,
    LEAST(5, GREATEST(1, ROUND((energy_level + mood)/2.0))) AS productivity_level
  FROM c
)
UPDATE daily_journal j
SET 
  sleep_quality_manual = COALESCE(j.sleep_quality_manual, c2.sleep_quality_manual),
  stress_level_manual = COALESCE(j.stress_level_manual, c2.stress_level_manual),
  energy_level = COALESCE(j.energy_level, c2.energy_level),
  mood = COALESCE(j.mood, c2.mood),
  productivity_level = COALESCE(j.productivity_level, c2.productivity_level),
  updated_at = NOW()
FROM c2
WHERE j.day = c2.day;
"""

COUNT_SQL = r"""
SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN mood IS NOT NULL THEN 1 ELSE 0 END) AS mood_filled,
  SUM(CASE WHEN energy_level IS NOT NULL THEN 1 ELSE 0 END) AS energy_filled,
  SUM(CASE WHEN productivity_level IS NOT NULL THEN 1 ELSE 0 END) AS productivity_filled,
  SUM(CASE WHEN stress_level_manual IS NOT NULL THEN 1 ELSE 0 END) AS stress_filled,
  SUM(CASE WHEN sleep_quality_manual IS NOT NULL THEN 1 ELSE 0 END) AS sleepq_filled
FROM daily_journal;
"""


def backfill(dry_run: bool = False) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            if not dry_run:
                cur.execute(BACKFILL_SQL)
                conn.commit()
            cur.execute(COUNT_SQL)
            row = cur.fetchone()
            if row:
                total, mood_f, energy_f, prod_f, stress_f, sleepq_f = row
                print("daily_journal status:")
                print(f"  total days:            {total}")
                print(f"  mood filled:           {mood_f}")
                print(f"  energy_level filled:   {energy_f}")
                print(f"  productivity filled:   {prod_f}")
                print(f"  stress_level filled:   {stress_f}")
                print(f"  sleep_quality filled:  {sleepq_f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill daily_journal with computed defaults")
    parser.add_argument("--dry-run", action="store_true", help="Only show counts, don't modify data")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
