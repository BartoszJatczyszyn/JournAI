from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from presentation.controllers import core_controller as ctl

router = APIRouter(tags=["core"], prefix="")

@router.get("/stats")
def get_stats():
    try:
        return ctl.stats()
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health-data")
def get_health_data(days: int = Query(30, ge=1, le=365)):
    try:
        return ctl.health_data(days)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/heart-rate/raw/{day}")
def get_heart_rate_raw(day: str):
    try:
        return ctl.heart_rate_raw(day)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stress/raw/{day}")
def get_stress_raw(day: str):
    try:
        return ctl.stress_raw(day)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/respiratory-rate/raw/{day}")
def get_respiratory_rate_raw(day: str):
    try:
        return ctl.respiratory_rate_raw(day)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
