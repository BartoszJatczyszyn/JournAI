from __future__ import annotations
from typing import Optional
from app.db import execute_query
from domain.repositories.weight import IWeightRepository

class PostgresWeightRepository(IWeightRepository):
    def latest(self) -> Optional[dict]:
        row = execute_query(
            "SELECT day, weight_kg, bmi, body_fat_percentage, muscle_mass_kg, body_water_percentage FROM garmin_weight WHERE weight_kg IS NOT NULL ORDER BY day DESC LIMIT 1",
            (),
            fetch_one=True,
        )
        return row if row else None

    def latest_day_only(self) -> Optional[dict]:
        return execute_query("SELECT day FROM garmin_weight ORDER BY day DESC LIMIT 1", (), fetch_one=True)

    def history(self, limit_days: int) -> list[dict]:
        rows = execute_query(
            """
            SELECT day, weight_kg, bmi, body_fat_percentage, muscle_mass_kg, body_water_percentage
            FROM garmin_weight
            WHERE weight_kg IS NOT NULL
            ORDER BY day DESC
            LIMIT %s
            """,
            (limit_days,),
            fetch_all=True,
        )
        return rows or []

    def recent_joined(self, days: int) -> list[dict]:
        return execute_query(
            f"""
            SELECT w.weight_kg, j.energy_level, j.mood, j.stress_level_manual, ds.sleep_score,
                   ds.steps, ds.resting_heart_rate
            FROM garmin_weight w
            LEFT JOIN daily_journal j ON j.day = w.day
            LEFT JOIN garmin_daily_summaries ds ON ds.day = w.day
            WHERE w.weight_kg IS NOT NULL
              AND w.day >= (CURRENT_DATE - INTERVAL '{days} day')
            ORDER BY w.day DESC
            """,
            (),
            fetch_all=True,
        ) or []
