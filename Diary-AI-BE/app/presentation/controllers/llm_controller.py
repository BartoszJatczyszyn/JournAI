from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date
import asyncio

from presentation.di import di
from infrastructure.analytics import SleepAnalytics, ActivityAnalytics, StressAnalytics
from application.services.llm_reports_service import ensure_table, upsert_report, get_latest, get_history


_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()


async def health() -> Dict[str, Any]:
    svc = di.llm_service()
    return await svc.health()


async def chat(messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 512, top_p: float = 0.95) -> Dict[str, Any]:
    svc = di.llm_service()
    return await svc.chat(messages, temperature=temperature, max_tokens=max_tokens, top_p=top_p)


def _build_health_brief(days: int = 30) -> str:
    # We intentionally call analytics directly here to avoid cyclical imports between routers
    # Sleep and stress specialized insights
    sleep_focus = _sleep.analyze_sleep_efficiency(min(days, 30))
    stress_focus = _stress.analyze_stress_patterns(min(days, 30))

    lines = []
    lines.append(f"Analysis period: last {days} days.")
    if isinstance(sleep_focus, dict) and sleep_focus.get("insights"):
        lines.append("Sleep — key insights:")
        for s in sleep_focus.get("insights")[:5]:
            lines.append(f"- {s}")
    if isinstance(stress_focus, dict) and stress_focus.get("insights"):
        lines.append("Stress — key insights:")
        for s in stress_focus.get("insights")[:5]:
            lines.append(f"- {s}")
    return "\n".join(lines)


async def health_report(days: int = 30, language: str = "en") -> Dict[str, Any]:
    svc = di.llm_service()
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
    res = await svc.chat(messages, temperature=0.2, max_tokens=700, top_p=0.9)
    return {"status": "success", "report": res.get("content", ""), "raw": res.get("raw")}


def reports_history(limit: int = 10, language: Optional[str] = None) -> Dict[str, Any]:
    ensure_table()
    rows = get_history(limit=limit, language=language)
    return {"status": "success", "reports": rows}


def latest_report(language: Optional[str] = None) -> Dict[str, Any]:
    ensure_table()
    row = get_latest(language)
    if not row:
        return {"status": "empty"}
    return {"status": "success", "report": row}


async def generate_and_store(days: int = 30, language: str = "en") -> Dict[str, Any]:
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
    svc = di.llm_service()
    res = await svc.chat(messages, temperature=0.2, max_tokens=700, top_p=0.9)
    content = res.get("content", "")
    today = date.today().isoformat()
    saved = upsert_report(today, language, days, content, res.get("raw"))
    return {"status": "success", "saved": saved}
