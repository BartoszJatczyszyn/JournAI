from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List
from contextlib import suppress

from db import execute_query


@dataclass
class CoreService:
    """Core read-only data aggregations used by the main dashboard.

    This service centralizes SQL and formatting so controllers and blueprints stay thin.
    """

    def get_stats(self) -> Dict[str, Any]:
        query = """
        WITH valid_days AS (
          SELECT * FROM garmin_daily_summaries
          WHERE NOT (COALESCE(steps,0)=0 AND COALESCE(calories_burned,0)=0)
        )
        SELECT 
          COUNT(*)               AS days_count,
          COALESCE(AVG(steps),0) AS avg_steps,
          COALESCE(AVG(calories_burned),0) AS avg_calories,
          COALESCE(AVG(resting_heart_rate),0) AS avg_rhr,
          COALESCE(AVG(stress_avg),0) AS avg_stress,
          MIN(day) AS first_day,
          MAX(day) AS last_day
        FROM valid_days
        """
        row = execute_query(query, fetch_one=True)
        data = dict(row) if row else {}
        for k in ["first_day", "last_day"]:
            if data.get(k) and hasattr(data[k], "isoformat"):
                data[k] = data[k].isoformat()
        for k, v in list(data.items()):
            if isinstance(v, Decimal):
                with suppress(Exception):
                    data[k] = float(v)
        return data

    def get_health_data(self, days: int) -> List[Dict[str, Any]]:
        query = """
        WITH last_valid_day AS (
          SELECT MAX(day) AS day
          FROM garmin_daily_summaries
          WHERE NOT (COALESCE(steps,0)=0 AND COALESCE(calories_burned,0)=0)
        )
        SELECT 
          g.day,
          g.steps,
          g.calories_burned AS calories,
          g.resting_heart_rate AS rhr,
          g.stress_avg,
          COALESCE(s.sleep_score, 0) AS sleep_score,
          (s.sleep_duration_seconds/60.0) AS time_in_bed_minutes,
          d.mood,
          d.energy_level AS energy
        FROM garmin_daily_summaries g
        JOIN last_valid_day lvd ON g.day <= lvd.day
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        WHERE g.day >= lvd.day - (%s - 1) * INTERVAL '1 day'
        ORDER BY g.day DESC
        """
        rows = execute_query(query, (days,), fetch_all=True) or []
        result: List[Dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            if item.get("day") and hasattr(item["day"], "isoformat"):
                item["day"] = item["day"].isoformat()
            for k in [
                "steps",
                "calories",
                "rhr",
                "stress_avg",
                "sleep_score",
                "time_in_bed_minutes",
                "mood",
                "energy",
            ]:
                if item.get(k) is None:
                    item[k] = 0 if k not in ("mood", "energy") else None
            if "energy_level" not in item:
                item["energy_level"] = item.get("energy")
            for k, v in list(item.items()):
                if isinstance(v, Decimal):
                    with suppress(Exception):
                        item[k] = float(v)
            result.append(item)
        return result

    def get_raw_series(self, table: str, day: str, value_column: str) -> List[Dict[str, Any]]:
        query = f"""
        SELECT ts, day, {value_column}
        FROM {table}
        WHERE day = %s
        ORDER BY ts
        """
        rows = execute_query(query, (day,), fetch_all=True) or []
        out: List[Dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            dts = item.get("ts")
            if hasattr(dts, "isoformat"):
                item["ts"] = dts.isoformat()
            dday = item.get("day")
            if hasattr(dday, "isoformat"):
                item["day"] = dday.isoformat()
            out.append(item)
        return out


__all__ = ["CoreService"]
