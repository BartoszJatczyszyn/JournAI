from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from schemas import ActivitiesListResponse, ActivityDetailResponse, Activity
from presentation.di import di

router = APIRouter(tags=["activities"], prefix="/activities")

_service = di.activities_service()

@router.get("/latest", response_model=ActivitiesListResponse)
async def get_latest_activities(
    limit: int = Query(20, ge=1, le=10000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    try:
        rows = await _service.latest(limit, start_date, end_date)
        items = []
        for item in rows:
            try:
                items.append(Activity(**item))
            except Exception:
                continue
        return { 'activities': items, 'count': len(items) }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/latest_raw")
async def get_latest_activities_raw(
    limit: int = Query(5, ge=1, le=1000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    """Return raw latest activities without schema filtering to troubleshoot serialization issues."""
    try:
        rows = await _service.latest(limit, start_date, end_date)
        return { 'rows': rows, 'count': len(rows) }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{activity_id}", response_model=ActivityDetailResponse)
async def get_activity_detail(activity_id: int):
    try:
        item = await _service.detail(activity_id)
        return {"activity": Activity(**item)}
    except LookupError:
        raise HTTPException(status_code=404, detail="Activity not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

activities_router = router
__all__ = ["router", "activities_router"]


@router.get('/debug/count')
async def debug_activities_count():
    try:
        res = await _service.debug_overview(365)
        return {
            'total_count': res.get('total_count'),
            'running_total': res.get('running_total'),
            'running_365': res.get('running_count'),
            'sample': res.get('raw_sample'),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/debug/advanced')
async def debug_activities_advanced(days: int = Query(90, ge=1, le=365)):
    try:
        res = await _service.debug_overview(days)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
