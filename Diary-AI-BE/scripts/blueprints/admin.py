from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from analytics.model_utils import model_path

router = APIRouter(tags=["admin"], prefix="/admin")

DEFAULT_MODELS = ["energy", "sleep", "mood"]

class RetrainRequest(BaseModel):
    models: Optional[List[str]] = None

@router.post("/models/retrain")
def retrain_models(payload: RetrainRequest):
    try:
        models = payload.models or DEFAULT_MODELS
        removed = []
        for name in models:
            p = model_path(name)
            try:
                if p.exists():
                    p.unlink()
                    removed.append(p.name)
            except Exception as e:  # pragma: no cover
                raise HTTPException(status_code=500, detail=f"Failed removing model {name}: {e}")
        return {
            "status": "success",
            "removed": removed,
            "message": "Models deleted; they will be retrained on next prediction request.",
        }
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router", "RetrainRequest"]
