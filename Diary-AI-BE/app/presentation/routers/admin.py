from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from presentation.controllers import admin_controller as ctl

router = APIRouter(tags=["admin"], prefix="/admin")

class RetrainRequest(BaseModel):
    models: Optional[List[str]] = None

@router.post("/models/retrain")
def retrain_models(payload: RetrainRequest):
    try:
        res = ctl.retrain_models(payload.models)
        if res.get("status") == "error":
            raise HTTPException(status_code=500, detail=res.get("message"))
        return res
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router", "RetrainRequest"]
