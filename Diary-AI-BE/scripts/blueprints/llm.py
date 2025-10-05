from __future__ import annotations

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query

from services.llm_service import LLMService
from analytics.enhanced_analytics_engine import EnhancedHealthAnalytics
from analytics.specialized_analytics import SleepAnalytics, ActivityAnalytics, StressAnalytics

router = APIRouter(tags=["llm"], prefix="/llm")

_llm = LLMService()
_enhanced = EnhancedHealthAnalytics()
_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()


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
def llm_health():
    status = _llm.health()
    if status.get("status") != "ok":
        raise HTTPException(status_code=503, detail=status)
    return status


@router.post("/chat", response_model=ChatResponse)
def llm_chat(req: ChatRequest):
    try:
        res = _llm.chat([m.model_dump() for m in req.messages], temperature=req.temperature, max_tokens=req.max_tokens, top_p=req.top_p)
        return ChatResponse(content=res.get("content", ""), raw=res.get("raw"))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


def _build_health_brief(days: int = 30) -> str:
    # Fetch data from analytics engines
    trends = None
    try:
        from blueprints.trends import health_trends  # reuse existing function to avoid duplication
        trends = health_trends(days)  # returns dict
    except Exception:
        trends = None
    insights = None
    try:
        from blueprints.insights import personalized_insights
        insights = personalized_insights(min(days, 60))
    except Exception:
        insights = None
    # Sleep focus
    sleep_focus = _sleep.analyze_sleep_efficiency(min(days, 30))
    stress_focus = _stress.analyze_stress_patterns(min(days, 30))

    lines = []
    lines.append(f"Analysis period: last {days} days.")
    if trends and isinstance(trends, dict):
        lines.append("Overall health direction: " + str(trends.get("overall_health_direction")))
        m = trends.get("metrics") or {}
        for key in ["sleep_score", "rhr", "stress_avg", "steps", "mood", "energy", "hrv"]:
            if key in m:
                md = m[key]
                lines.append(f"- {key}: direction={md.get('direction')}, change%={round((md.get('pct_change') or 0)*100, 1)}")
    if insights and isinstance(insights, dict):
        hi = (insights.get("insights") or {}).get("highlights")
        if hi:
            lines.append("Key observations:")
            for h in hi[:5]:
                lines.append(f"- {h}")
    if isinstance(sleep_focus, dict) and sleep_focus.get("insights"):
        lines.append("Sleep — key insights:")
        for s in sleep_focus.get("insights")[:5]:
            lines.append(f"- {s}")
    if isinstance(stress_focus, dict) and stress_focus.get("insights"):
        lines.append("Stress — key insights:")
        for s in stress_focus.get("insights")[:5]:
            lines.append(f"- {s}")

    return "\n".join(lines)


@router.get("/health-report")
def llm_health_report(days: int = Query(30, ge=7, le=180), language: str = Query("en")):
    try:
        brief = _build_health_brief(days)
        system_prompt = (
            "You are a health and sports assistant. You will receive a summary of trends and insights. "
            "Prepare a concise report (max 400–600 words) in English, including: \n"
            "- key trends and their significance, \n"
            "- factors that may affect sleep, stress, energy, \n"
            "- 3–5 practical recommendations (SMART), \n"
            "- a short plan for the upcoming week.\n"
            "Use a clear, empathetic tone. When data is uncertain, state it."
        )
        if language and language.lower() != "en":
            system_prompt = system_prompt.replace("English", language)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Data for the report (JSON/text):\n{brief}"},
        ]
        res = _llm.chat(messages, temperature=0.2, max_tokens=700, top_p=0.9)
        return {"status": "success", "report": res.get("content", ""), "raw": res.get("raw")}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


from datetime import date, datetime
from services.llm_reports_service import ensure_table, upsert_report, get_latest, get_history

@router.get("/reports/history")
def reports_history(limit: int = Query(10, ge=1, le=100), language: str | None = None):
    try:
        ensure_table()
        rows = get_history(limit=limit, language=language)
        return {"status": "success", "reports": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/latest")
def latest_report(language: str | None = None):
    try:
        ensure_table()
        row = get_latest(language)
        if not row:
            return {"status": "empty"}
        return {"status": "success", "report": row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/generate")
def generate_and_store(days: int = Query(30, ge=7, le=180), language: str = Query("en")):
    try:
        ensure_table()
        brief = _build_health_brief(days)
        system_prompt = (
            "You are a health and sports assistant. You will receive a summary of trends and insights. "
            "Prepare a concise report (max 400–600 words) in English."
        )
        if language and language.lower() != "en":
            system_prompt = system_prompt.replace("English", language)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Data for the report (JSON/text):\n{brief}"},
        ]
        res = _llm.chat(messages, temperature=0.2, max_tokens=700, top_p=0.9)
        content = res.get("content", "")
        today = date.today().isoformat()
        saved = upsert_report(today, language, days, content, res.get("raw"))
        return {"status": "success", "saved": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
