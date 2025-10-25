from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from presentation.controllers import trends_controller as ctl

router = APIRouter(tags=["trends"], prefix="/trends")


@router.get("/health")
async def health_trends(days: int = Query(90, ge=2, le=365)):
    try:
        return await ctl.health_trends(days)
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
