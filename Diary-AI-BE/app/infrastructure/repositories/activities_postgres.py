from __future__ import annotations
from typing import Any, List, Tuple
from app.db import async_execute_query
from domain.repositories.activities import IActivitiesRepository

class PostgresActivitiesRepository(IActivitiesRepository):
    async def fetch_latest(self, where_sql: str, params: Tuple[Any, ...], limit: int) -> List[dict]:
        # Clamp the limit to a sane range and avoid SQL injection by not interpolating params
        try:
            safe_limit = int(limit)
        except Exception:
            safe_limit = 20
        if safe_limit < 1:
            safe_limit = 1
        if safe_limit > 1000:
            safe_limit = 1000

        query = f"""
            SELECT activity_id,
                   name,
                   sport,
                   sub_sport,
                   start_time,
                   day,
                   -- keep raw meters as distance for compatibility; provide km as convenience
                   distance,
                   (COALESCE(distance, 0) / 1000.0) AS distance_km,
                   avg_speed,
                   avg_pace,
                   -- expose seconds explicitly for list consumers
                   elapsed_time AS elapsed_time_seconds,
                   avg_hr,
                   calories,
                   training_effect,
                   anaerobic_training_effect
              FROM garmin_activities
             WHERE {where_sql}
             ORDER BY start_time DESC
             LIMIT {safe_limit}
            """
        rows = await async_execute_query(query, params) or []
        return [dict(r) for r in rows]

    async def get_detail(self, activity_id: int) -> dict | None:
        query = """
        SELECT activity_id,
               name,
               sport,
               sub_sport,
               start_time,
               stop_time,
               day,
               -- keep raw meters and provide km
               distance,
               (COALESCE(distance, 0) / 1000.0) AS distance_km,
               -- provide both names for compatibility with service.detail
               elapsed_time,
               elapsed_time AS elapsed_time_seconds,
               avg_speed,
               avg_pace,
               avg_hr,
               max_hr,
               calories,
               training_load,
               training_effect,
               anaerobic_training_effect
          FROM garmin_activities
         WHERE activity_id = %s
         LIMIT 1
        """
        row = await async_execute_query(query, (activity_id,), fetch_one=True)
        return dict(row) if row else None

    async def debug_counts(self, days: int) -> tuple[int, int]:
        q_count = (
            """
            SELECT COUNT(*) as cnt FROM garmin_activities
            WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
              AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
            """
            % days
        )
        c = await async_execute_query(q_count, fetch_one=True) or {'cnt': 0}
        q_pace = (
            """
            SELECT COUNT(*) as cnt FROM garmin_activities
            WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
              AND avg_pace IS NOT NULL
              AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
            """
            % days
        )
        p = await async_execute_query(q_pace, fetch_one=True) or {'cnt': 0}
        return int(c.get('cnt') or 0), int(p.get('cnt') or 0)

    async def debug_sample(self, days: int) -> List[dict]:
        q_sample = (
            """
            SELECT activity_id, sport, start_time, day, distance, avg_pace
            FROM garmin_activities
            WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
              AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
            ORDER BY start_time DESC
            LIMIT 20
            """
            % days
        )
        sample = await async_execute_query(q_sample) or []
        for r in sample:
            if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                r['start_time'] = r['start_time'].isoformat()
            if r.get('day') and hasattr(r['day'], 'isoformat'):
                r['day'] = r['day'].isoformat()
        return sample

    async def labels(self, days: int) -> List[dict]:
        q_labels = (
            """
            SELECT sport, COUNT(*) as cnt FROM garmin_activities
            WHERE start_time::date >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY sport ORDER BY cnt DESC LIMIT 20
            """
            % days
        )
        return await async_execute_query(q_labels) or []

    async def vo2_count(self, days: int) -> int:
        q_vo2 = (
            """
            SELECT COUNT(*) as with_vo2 FROM garmin_activities
            WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                AND vo2_max IS NOT NULL
                AND start_time::date >= CURRENT_DATE - INTERVAL '%s days'
            """
            % days
        )
        res = await async_execute_query(q_vo2, fetch_one=True) or {"with_vo2": 0}
        return int(res.get("with_vo2") or 0)

    async def raw_running_range(self, start_date: str, end_date: str) -> List[dict]:
        q = f"""
        SELECT activity_id, sport, start_time, day, distance, avg_pace
        FROM garmin_activities
        WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
          AND (COALESCE(day, start_time::date) BETWEEN '{start_date}' AND '{end_date}')
        ORDER BY start_time DESC
        LIMIT 50
        """
        rows = await async_execute_query(q) or []
        for r in rows:
            if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                r['start_time'] = r['start_time'].isoformat()
            if r.get('day') and hasattr(r['day'], 'isoformat'):
                r['day'] = r['day'].isoformat()
        return rows

    async def count_all(self) -> int:
        q = "SELECT COUNT(*) AS cnt FROM garmin_activities"
        res = await async_execute_query(q, fetch_one=True) or {"cnt": 0}
        try:
            return int(res.get('cnt') or 0)
        except Exception:
            return 0

    async def count_running_total(self) -> int:
        q = (
            """
            SELECT COUNT(*) AS cnt FROM garmin_activities
            WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
            """
        )
        res = await async_execute_query(q, fetch_one=True) or {"cnt": 0}
        try:
            return int(res.get('cnt') or 0)
        except Exception:
            return 0
