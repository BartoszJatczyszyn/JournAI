from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from db import async_execute_query
from schemas import ActivitiesListResponse, ActivityDetailResponse, Activity
import logging
import traceback

_log = logging.getLogger(__name__)
from datetime import datetime, time as time_type
from typing import Any

router = APIRouter(tags=["activities"], prefix="/activities")

@router.get("/latest", response_model=ActivitiesListResponse)
async def get_latest_activities(
    limit: int = Query(20, ge=1, le=10000),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD) to filter start_time >= start_date"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD) to filter start_time <= end_date"),
):
    try:
        # Build dynamic WHERE clause to support optional date filtering
        where_clauses = ["start_time IS NOT NULL"]
        params: list = []
        if start_date:
            where_clauses.append("start_time >= %s")
            params.append(start_date)
        if end_date:
            where_clauses.append("start_time <= %s")
            params.append(end_date)

        where_sql = " AND ".join(where_clauses)

        query = f"""
        SELECT
            activity_id,
            name,
            sport,
            sub_sport,
            start_time,
            stop_time,
            elapsed_time,
            distance,
            training_load,
            training_effect,
            anaerobic_training_effect,
            calories,
            avg_hr,
            max_hr,
            avg_speed,
            avg_pace
        FROM garmin_activities
        WHERE {where_sql}
        ORDER BY start_time DESC
        LIMIT %s
        """
        params.append(limit)
        rows = await async_execute_query(query, params) or []
        res: list[Activity] = []
        for r in rows:
            item = dict(r)
            if item.get('start_time'):
                item['start_time'] = item['start_time'].isoformat()
            if item.get('stop_time'):
                item['stop_time'] = item['stop_time'].isoformat()
            if item.get('distance') is not None:
                item['distance_km'] = round((item['distance'] or 0) / 1000.0, 2)
            if item.get('elapsed_time') is not None:
                item['duration_min'] = round((item['elapsed_time'] or 0) / 60.0, 1)
            # Compute avg_pace for list responses when DB value is missing
            if item.get('avg_pace') in (None, ''):
                try:
                    # prefer avg_speed (km/h) if available
                    if item.get('avg_speed'):
                        pace = 60.0 / float(item['avg_speed'])
                        item['avg_pace'] = round(pace, 3)
                    # fallback to elapsed_time/distance
                    elif item.get('distance') is not None and item.get('elapsed_time'):
                        try:
                            dist_km = float(item['distance']) / 1000.0 if item.get('distance') is not None else None
                            dur_min = float(item['elapsed_time']) / 60.0
                            if dist_km and dist_km > 0:
                                item['avg_pace'] = round(dur_min / dist_km, 3)
                        except Exception:
                            pass
                except Exception:
                    pass
            # Coerce avg_pace to a numeric minutes-per-km if it's a time or string
            try:
                ap = item.get('avg_pace')
                if ap is not None:
                    # datetime.time -> minutes
                    if isinstance(ap, time_type):
                        item['avg_pace'] = float(ap.hour * 60 + ap.minute + ap.second / 60.0 + ap.microsecond / 60000000.0)
                    # string like 'MM:SS' or 'HH:MM:SS'
                    elif isinstance(ap, str):
                        parsed = None
                        for fmt in ('%H:%M:%S', '%M:%S'):
                            try:
                                dt = datetime.strptime(ap, fmt)
                                parsed = dt.time()
                                break
                            except Exception:
                                parsed = None
                        if parsed is not None:
                            item['avg_pace'] = float(parsed.hour * 60 + parsed.minute + parsed.second / 60.0 + parsed.microsecond / 60000000.0)
                        else:
                            # fallback: try numeric parse
                            try:
                                item['avg_pace'] = float(str(ap).strip())
                            except Exception:
                                # leave as-is to let pydantic possibly reject, but handled below
                                pass
                # finally build model
                res.append(Activity(**item))
            except Exception as ex:
                # Log and skip malformed rows rather than failing the entire request
                _log.error('Skipping malformed activity row (activity_id=%s): %s', item.get('activity_id'), ex)
                _log.debug('Malformed item content: %s', item)
                continue
        return {"activities": res, "count": len(res)}
    except Exception as e:  # pragma: no cover
        _log.error("Error in get_latest_activities: %s", e)
        _log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{activity_id}", response_model=ActivityDetailResponse)
async def get_activity_detail(activity_id: int):
    try:
        row = await async_execute_query("SELECT * FROM garmin_activities WHERE activity_id = %s", (activity_id,), fetch_one=True)
        if not row:
            raise HTTPException(status_code=404, detail="Activity not found")
        item = dict(row)
        for k in ['start_time', 'stop_time']:
            if item.get(k):
                item[k] = item[k].isoformat()
        if item.get('distance') is not None:
            item['distance_km'] = round((item['distance'] or 0) / 1000.0, 2)
        if item.get('elapsed_time') is not None:
            item['duration_min'] = round((item['elapsed_time'] or 0) / 60.0, 1)
        # Compute avg_pace as minutes per km when possible. avg_speed is stored in km/h
        if item.get('avg_speed') is not None and item['avg_speed']:
            try:
                # pace (min/km) = 60 (minutes per hour) / speed (km per hour)
                pace = 60.0 / float(item['avg_speed'])
                item['avg_pace'] = round(pace, 2)
            except Exception:
                pass
        return {"activity": Activity(**item)}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

activities_router = router
__all__ = ["router", "activities_router"]


@router.get('/debug/count')
async def debug_activities_count():
    """Debug helper: return counts of running activities the backend can see.

    - total_count: total rows in garmin_activities
    - running_total: rows with sport ILIKE 'running'
    - running_365: rows with sport ILIKE 'running' and start_time in last 365 days
    - sample_ids: up to 10 most recent running activity_ids
    """
    try:
        # total
        total = await async_execute_query('SELECT count(*) as cnt FROM garmin_activities', fetch_one=True) or {'cnt': 0}
        running_total = await async_execute_query("SELECT count(*) as cnt FROM garmin_activities WHERE sport ILIKE 'running'", fetch_one=True) or {'cnt': 0}
        running_365 = await async_execute_query("SELECT count(*) as cnt FROM garmin_activities WHERE sport ILIKE 'running' AND start_time >= now() - interval '365 days'", fetch_one=True) or {'cnt': 0}
        sample = await async_execute_query("SELECT activity_id, start_time, distance FROM garmin_activities WHERE sport ILIKE 'running' ORDER BY start_time DESC LIMIT 10") or []
        # normalize datetimes to iso strings
        for r in sample:
            if r.get('start_time'):
                try:
                    r['start_time'] = r['start_time'].isoformat()
                except Exception:
                    pass
        return {
            'total_count': int(total.get('cnt') or 0),
            'running_total': int(running_total.get('cnt') or 0),
            'running_365': int(running_365.get('cnt') or 0),
            'sample': sample,
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/debug/advanced')
async def debug_activities_advanced(days: int = Query(90, ge=1, le=365)):
        """Advanced debug: run COALESCE(day, start_time::date) queries to mirror analytics filter.

        Returns:
            - running_count: number of rows with sport ILIKE 'running' in window
            - running_with_pace: rows with avg_pace not null
            - raw_sample: up to 20 recent rows matching the COALESCE filter
        """
        try:
                q_count = """
                SELECT COUNT(*) as cnt FROM garmin_activities
                WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                    AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
                """ % days
                c = await async_execute_query(q_count, fetch_one=True) or {'cnt': 0}

                q_pace = """
                SELECT COUNT(*) as cnt FROM garmin_activities
                WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                    AND avg_pace IS NOT NULL
                    AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
                """ % days
                p = await async_execute_query(q_pace, fetch_one=True) or {'cnt': 0}

                q_sample = """
                SELECT activity_id, sport, start_time, day, distance, avg_pace
                FROM garmin_activities
                WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                    AND (COALESCE(day, start_time::date) >= CURRENT_DATE - INTERVAL '%s days')
                ORDER BY start_time DESC
                LIMIT 20
                """ % days
                sample = await async_execute_query(q_sample) or []
                for r in sample:
                        if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                                r['start_time'] = r['start_time'].isoformat()
                        if r.get('day') and hasattr(r['day'], 'isoformat'):
                                r['day'] = r['day'].isoformat()
                return {
                        'running_count': int(c.get('cnt') or 0),
                        'running_with_pace': int(p.get('cnt') or 0),
                        'raw_sample': sample,
                }
        except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
