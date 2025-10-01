from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date

class SleepSession(BaseModel):
    model_config = ConfigDict(extra="allow")
    sleep_id: int
    day: Optional[date] = None
    sleep_start: Optional[datetime] = None
    sleep_end: Optional[datetime] = None
    sleep_duration_seconds: Optional[int] = None
    deep_sleep_seconds: Optional[int] = None
    light_sleep_seconds: Optional[int] = None
    rem_sleep_seconds: Optional[int] = None
    awake_seconds: Optional[int] = None
    sleep_score: Optional[int] = None
    efficiency_pct: Optional[float] = None
    duration_min: Optional[int] = None
    avg_sleep_hr: Optional[float] = None
    avg_sleep_rr: Optional[float] = None
    avg_sleep_stress: Optional[float] = None
    last_sleep_phase: Optional[str] = None
    sleep_events: list[dict] = []
    hr_series: list[dict] = []
    stress_series: list[dict] = []
    rr_series: list[dict] = []

class SleepListResponse(BaseModel):
    sleeps: list[SleepSession]
    count: int
    total_count: int

class SleepDetailResponse(BaseModel):
    sleep: SleepSession
