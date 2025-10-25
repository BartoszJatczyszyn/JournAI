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
    # Human-readable label derived from last_sleep_phase ('Deep','Light','REM','Awake')
    last_sleep_phase_label: Optional[str] = None
    # Numeric encoded phase observed just before wake (1=Deep,2=Light,3=REM,4=Awake)
    last_pre_wake_phase: Optional[int] = None
    # Human-readable label for last_pre_wake_phase ('Deep','Light','REM','Awake')
    last_pre_wake_phase_label: Optional[str] = None
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
