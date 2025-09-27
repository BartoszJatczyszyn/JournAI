#!/usr/bin/env python3
"""Core blueprint: basic stats and health-data endpoints required by frontend dashboard.

Provides lightweight aggregated stats and a daily health data list combining
garmin_daily_summaries with journal mood/energy (if present).

Endpoints:
  GET /api/stats
  GET /api/health-data?days=N

Both are intentionally fast: single SQL each; no heavy joins beyond journal.
"""
from __future__ import annotations

from datetime import date
from flask import Blueprint, jsonify, request
from decimal import Decimal
from contextlib import suppress
from db import execute_query

core_bp = Blueprint("core", __name__)


@core_bp.get("/stats")
def get_stats():
    """Return high-level aggregate stats used on dashboard cards.

    Fields chosen to match expected frontend usage (can extend later).
    """
    try:
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
            if data.get(k) and hasattr(data[k], 'isoformat'):
                data[k] = data[k].isoformat()
        for k, v in list(data.items()):
            if isinstance(v, Decimal):
                with suppress(Exception):  # type: ignore
                    data[k] = float(v)
        return jsonify(data)
    except Exception as e:  # pragma: no cover
        return jsonify({'error': str(e)}), 500


@core_bp.get("/health-data")
def get_health_data():
    """Return per-day health data rows for last N days (default 30).

    Shape expected by frontend: [{day, steps, calories, rhr, stress_avg, sleep_score,
    time_in_bed_minutes, mood, energy}]
    """
    try:
        days = request.args.get('days', 30, type=int)
        days = max(1, min(days, 365))
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
    -- Ensure inclusive window of N days (e.g. days=7 returns last 7 calendar days)
    WHERE g.day >= lvd.day - (%s - 1) * INTERVAL '1 day'
        ORDER BY g.day DESC
        """
        rows = execute_query(query, (days,)) or []
        result = []
        for r in rows:
            item = dict(r)
            day_val = item.get('day')
            if day_val and hasattr(day_val, 'isoformat'):
                item['day'] = day_val.isoformat()
            for k in ['steps','calories','rhr','stress_avg','sleep_score','time_in_bed_minutes','mood','energy']:
                if item.get(k) is None:
                    item[k] = 0 if k not in ('mood','energy') else None
            if 'energy_level' not in item:
                item['energy_level'] = item.get('energy')
            for k, v in list(item.items()):
                if isinstance(v, Decimal):
                    with suppress(Exception):  # type: ignore
                        item[k] = float(v)
            result.append(item)
        return jsonify(result)
    except Exception as e:  # pragma: no cover
        return jsonify({'error': str(e)}), 500


__all__ = ["core_bp"]
