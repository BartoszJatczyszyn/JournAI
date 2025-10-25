from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from presentation.controllers import weight_controller as ctl

router = APIRouter(tags=["weight"], prefix="/weight")

@router.get("/current")
def current_weight():
    try:
        return ctl.current_weight()
    except LookupError:
        raise HTTPException(status_code=404, detail="no weight data")

@router.get("/history")
def weight_history(days: int = Query(90, ge=1, le=365)):
    return ctl.weight_history(days)

@router.get("/stats")
def weight_stats():
    try:
        return ctl.weight_stats()
    except LookupError:
        raise HTTPException(status_code=404, detail="no weight data")

@router.get("/correlations")
def weight_correlations(days: int = Query(90, ge=7, le=365), min_abs: float = 0.0):
    return ctl.weight_correlations(days, min_abs)

__all__ = ["router"]
