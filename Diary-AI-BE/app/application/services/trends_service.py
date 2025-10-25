from __future__ import annotations

from typing import Any, List, Dict

from app.db import execute_query


class TrendsService:
    

    def sleep_trend(self, days: int = 30) -> List[Dict[str, Any]]:
        query = """
        SELECT 
            day,
            (sleep_duration_seconds/60.0) as time_in_bed_minutes,
            sleep_score,
            (deep_sleep_seconds/60.0) as deep_sleep,
            (light_sleep_seconds/60.0) as light_sleep,
            (rem_sleep_seconds/60.0) as rem_sleep
        FROM garmin_sleep_sessions 
        WHERE day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_sleep_sessions) - INTERVAL '%s days'
        ORDER BY day DESC
        LIMIT %s
        """
        data = execute_query(query, (days, days)) or []
        for row in data:
            if row.get("day"):
                try:
                    row["day"] = row["day"].isoformat()
                except Exception:
                    row["day"] = str(row["day"])
        return data

    def weight_trend(self, days: int = 90) -> List[Dict[str, Any]]:
        query = """
        SELECT 
            day,
            weight_kg as weight
        FROM garmin_weight 
        WHERE day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_sleep_sessions) - INTERVAL '%s days'
        ORDER BY day DESC
        """
        data = execute_query(query, (days,)) or []
        for row in data:
            if row.get("day"):
                try:
                    row["day"] = row["day"].isoformat()
                except Exception:
                    row["day"] = str(row["day"])
        return data

    def mood_distribution(self) -> List[Dict[str, Any]]:
        query = """
        SELECT 
            mood,
            COUNT(*) as count
        FROM daily_journal 
        WHERE mood IS NOT NULL
        GROUP BY mood
        ORDER BY mood
        """
        return execute_query(query) or []

__all__ = ["TrendsService"]
