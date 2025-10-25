from __future__ import annotations

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query

from presentation.controllers import llm_controller as ctl

router = APIRouter(tags=["llm"], prefix="/llm")

"""LLM endpoints delegating to controller; keeps Pydantic I/O schemas stable."""


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: float = 0.3
    max_tokens: int = 512
    top_p: float = 0.95

class ChatResponse(BaseModel):
    content: str
    raw: Optional[Dict[str, Any]] = None


@router.get("/health")
async def llm_health():
    status = await ctl.health()
    if status.get("status") != "ok":
        raise HTTPException(status_code=503, detail=status)
    return status


@router.post("/chat", response_model=ChatResponse)
async def llm_chat(req: ChatRequest):
    try:
        res = await ctl.chat([m.model_dump() for m in req.messages], temperature=req.temperature, max_tokens=req.max_tokens, top_p=req.top_p)
        return ChatResponse(content=res.get("content", ""), raw=res.get("raw"))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health-report")
async def llm_health_report(days: int = Query(30, ge=7, le=180), language: str = Query("en")):
    try:
        res = await ctl.health_report(days=days, language=language)
        return res
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


from presentation.controllers import llm_controller as _ctl_reports

@router.get("/reports/history")
def reports_history(limit: int = Query(10, ge=1, le=100), language: str | None = None):
    try:
        return _ctl_reports.reports_history(limit=limit, language=language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/latest")
def latest_report(language: str | None = None):
    try:
        return _ctl_reports.latest_report(language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/generate")
async def generate_and_store(days: int = Query(30, ge=7, le=180), language: str = Query("en")):
    try:
        return await _ctl_reports.generate_and_store(days=days, language=language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
