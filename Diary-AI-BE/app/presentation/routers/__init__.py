# FastAPI routers (presentation layer)
from __future__ import annotations

from .analytics import router as analytics_router
from .predictions import router as predictions_router
from .admin import router as admin_router
from .insights import router as insights_router
from .activities import activities_router
from .sleeps import sleeps_router
from .core import router as core_router
from .trends import router as trends_router
from .journal import router as journal_router
from .gym import router as gym_router
from .llm import router as llm_router
from .weight import router as weight_router

__all__ = [
    "analytics_router",
    "predictions_router",
    "admin_router",
    "insights_router",
    "activities_router",
    "sleeps_router",
    "core_router",
    "trends_router",
    "journal_router",
    "gym_router",
    "llm_router",
    "weight_router",
]
