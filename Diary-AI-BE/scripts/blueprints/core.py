from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from decimal import Decimal
from contextlib import suppress
from db import execute_query

router = APIRouter(tags=["core"], prefix="")

@router.get("/stats")
def get_stats():
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
                with suppress(Exception):
                    data[k] = float(v)
        return data
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health-data")
def get_health_data(days: int = Query(30, ge=1, le=365)):
    try:
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
        rows = execute_query(query, (days,)) or []
        result = []
        for r in rows:
            item = dict(r)
            if item.get('day') and hasattr(item['day'], 'isoformat'):
                item['day'] = item['day'].isoformat()
            for k in ['steps','calories','rhr','stress_avg','sleep_score','time_in_bed_minutes','mood','energy']:
                if item.get(k) is None:
                    item[k] = 0 if k not in ('mood','energy') else None
            if 'energy_level' not in item:
                item['energy_level'] = item.get('energy')
            for k, v in list(item.items()):
                if isinstance(v, Decimal):
                    with suppress(Exception):
                        item[k] = float(v)
            result.append(item)
        return result
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/heart-rate/raw/{day}")
def get_heart_rate_raw(day: str):
    """Return minute-level heart rate rows from garmin_heart_rate_data for the requested day.

    Response: list of { ts, day, bpm }
    """
    try:
        query = """
        SELECT ts, day, bpm
        FROM garmin_heart_rate_data
        WHERE day = %s
        ORDER BY ts
        """
        rows = execute_query(query, (day,), fetch_all=True) or []
        out = []
        for r in rows:
            item = dict(r)
            # convert datetimes to iso strings when applicable
            dts = item.get('ts')
            if hasattr(dts, 'isoformat'):
                item['ts'] = dts.isoformat()
            dday = item.get('day')
            if hasattr(dday, 'isoformat'):
                item['day'] = dday.isoformat()
            out.append(item)
        return out
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stress/raw/{day}")
def get_stress_raw(day: str):
    """Return minute-level stress rows from garmin_stress_data for the requested day.

    Response: list of { ts, day, stress }
    """
    try:
        query = """
        SELECT ts, day, stress
        FROM garmin_stress_data
        WHERE day = %s
        ORDER BY ts
        """
        rows = execute_query(query, (day,), fetch_all=True) or []
        out = []
        for r in rows:
            item = dict(r)
            dts = item.get('ts')
            if hasattr(dts, 'isoformat'):
                item['ts'] = dts.isoformat()
            dday = item.get('day')
            if hasattr(dday, 'isoformat'):
                item['day'] = dday.isoformat()
            out.append(item)
        return out
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/respiratory-rate/raw/{day}")
def get_respiratory_rate_raw(day: str):
    """Return minute-level respiratory rate rows from garmin_respiratory_rate_data for the requested day.

    Response: list of { ts, day, rr }
    """
    try:
        query = """
        SELECT ts, day, rr
        FROM garmin_respiratory_rate_data
        WHERE day = %s
        ORDER BY ts
        """
        rows = execute_query(query, (day,), fetch_all=True) or []
        out = []
        for r in rows:
            item = dict(r)
            dts = item.get('ts')
            if hasattr(dts, 'isoformat'):
                item['ts'] = dts.isoformat()
            dday = item.get('day')
            if hasattr(dday, 'isoformat'):
                item['day'] = dday.isoformat()
            out.append(item)
        return out
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
