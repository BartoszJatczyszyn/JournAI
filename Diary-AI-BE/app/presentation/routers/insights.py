from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from presentation.controllers import insights_controller as ctl

router = APIRouter(tags=["insights"], prefix="/insights")

@router.get("/personalized")
async def personalized_insights(days: int = Query(60, ge=7, le=365)):
    try:
        return await ctl.personalized(days)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimization")
async def optimization_insights(metric: str = Query("sleep_quality"), days: int = Query(60, ge=7, le=365)):
    try:
        return await ctl.optimization(metric, days)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
