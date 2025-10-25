"""Pydantic schemas for selected API responses.

Only a subset of endpoints are strongly typed to avoid breaking existing
frontends that rely on free-form JSON for analytics.
"""
from .activities import Activity, ActivitiesListResponse, ActivityDetailResponse
from .sleeps import SleepSession, SleepListResponse, SleepDetailResponse
from .core import StatsResponse, HealthDataRow
from .analytics import AnalysisResponse

__all__ = [
    "Activity",
    "ActivitiesListResponse",
    "ActivityDetailResponse",
    "SleepSession",
    "SleepListResponse",
    "SleepDetailResponse",
    "StatsResponse",
    "HealthDataRow",
    "AnalysisResponse",
]
