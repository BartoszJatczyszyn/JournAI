from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from presentation.controllers import predictions_controller as ctl

router = APIRouter(tags=["predictions"], prefix="/predictions")
"""Predictions API routes delegating to the controller layer.

All concurrency/timeouts are handled inside controllers/services.
"""

@router.get("/energy")
async def predict_energy(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        return await ctl.energy(days_ahead)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sleep")
async def predict_sleep(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        return await ctl.sleep(days_ahead)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mood")
async def predict_mood(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        return await ctl.mood(days_ahead)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/comprehensive")
async def predict_comprehensive(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        return await ctl.comprehensive(days_ahead)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]

