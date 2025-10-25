from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date

class StatsResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    days_count: int
    avg_steps: float
    avg_calories: float
    avg_rhr: float
    avg_stress: float
    first_day: Optional[date] = None
    last_day: Optional[date] = None

class HealthDataRow(BaseModel):
    model_config = ConfigDict(extra="allow")
    day: date
    steps: int
    calories: int
    rhr: int | float | None = None
    stress_avg: int | float | None = None
    sleep_score: int | float | None = None
    time_in_bed_minutes: float | None = None
    mood: int | float | None = None
    energy: int | float | None = None
    energy_level: int | float | None = None
