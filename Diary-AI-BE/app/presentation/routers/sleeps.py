from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from schemas import SleepListResponse, SleepDetailResponse, SleepSession
from pydantic import BaseModel
from datetime import datetime, date
from presentation.controllers import sleeps_controller as ctl


class SleepCreate(BaseModel):
    day: date | None = None
    sleep_start: datetime | None = None
    sleep_end: datetime | None = None
    sleep_duration_seconds: int | None = None
    deep_sleep_seconds: int | None = None
    light_sleep_seconds: int | None = None
    rem_sleep_seconds: int | None = None
    awake_seconds: int | None = None
    sleep_score: int | None = None
    avg_sleep_hr: float | None = None
    avg_sleep_rr: float | None = None
    avg_sleep_stress: float | None = None


router = APIRouter(tags=["sleeps"], prefix="")

@router.get("/sleeps/latest", response_model=SleepListResponse)
async def get_latest_sleeps(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    start_date: str | None = None,
    end_date: str | None = None,
):
    try:
        res = await ctl.latest(limit, offset, start_date, end_date)
        items = [SleepSession(**s) for s in res['sleeps']]
        return { 'total_count': res['total_count'], 'sleeps': items, 'count': len(items) }
    except RuntimeError as re:  # pragma: no cover - e.g. async DB not available
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sleeps/{sleep_id}", response_model=SleepDetailResponse)
async def get_sleep_detail(sleep_id: int):
    try:
        item = await ctl.detail(sleep_id)
        return {"sleep": SleepSession(**item)}
    except LookupError:
        raise HTTPException(status_code=404, detail="Sleep session not found")
    except RuntimeError as re:  # pragma: no cover - DB driver/connectivity issues
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))



@router.post('/sleeps', response_model=SleepDetailResponse)
async def create_sleep(payload: SleepCreate):
    try:
        item = await ctl.create_sleep(payload.model_dump())
        return {'sleep': SleepSession(**item)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/sleeps/{sleep_id}', response_model=SleepDetailResponse)
async def update_sleep(sleep_id: int, payload: SleepCreate):
    try:
        item = await ctl.update_sleep(sleep_id, payload.model_dump())
        return {'sleep': SleepSession(**item)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError:
        raise HTTPException(status_code=404, detail='Sleep session not found')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/sleeps/{sleep_id}')
async def delete_sleep(sleep_id: int):
    try:
        ok = await ctl.delete_sleep(sleep_id)
        if not ok:
            raise HTTPException(status_code=404, detail='Sleep session not found')
        return { 'deleted': True }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

sleeps_router = router
__all__ = ["router", "sleeps_router"]
