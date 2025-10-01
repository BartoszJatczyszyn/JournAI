from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from db import execute_query
from schemas import ActivitiesListResponse, ActivityDetailResponse, Activity

router = APIRouter(tags=["activities"], prefix="/activities")

@router.get("/latest", response_model=ActivitiesListResponse)
def get_latest_activities(limit: int = Query(20, ge=1, le=200)):
    try:
        query = """
        SELECT 
            activity_id,
            name,
            sport,
            sub_sport,
            start_time,
            stop_time,
            elapsed_time,
            distance,
            calories,
            avg_hr,
            max_hr
        FROM garmin_activities
        WHERE start_time IS NOT NULL
        ORDER BY start_time DESC
        LIMIT %s
        """
        rows = execute_query(query, (limit,)) or []
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
            res.append(Activity(**item))
        return {"activities": res, "count": len(res)}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{activity_id}", response_model=ActivityDetailResponse)
def get_activity_detail(activity_id: int):
    try:
        row = execute_query("SELECT * FROM garmin_activities WHERE activity_id = %s", (activity_id,), fetch_one=True)
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
        if item.get('avg_speed') is not None and item['avg_speed']:
            try:
                pace = (1000.0 / item['avg_speed']) / 60.0
                item['avg_pace_min_per_km'] = round(pace, 2)
            except Exception:
                pass
        return {"activity": Activity(**item)}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

activities_router = router
__all__ = ["router", "activities_router"]
