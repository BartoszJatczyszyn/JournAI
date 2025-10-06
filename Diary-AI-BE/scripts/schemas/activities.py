from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class Activity(BaseModel):
    model_config = ConfigDict(extra="allow")
    activity_id: int
    name: Optional[str] = None
    sport: Optional[str] = None
    sub_sport: Optional[str] = None
    start_time: Optional[datetime] = None
    stop_time: Optional[datetime] = None
    elapsed_time: Optional[int] = None
    distance: Optional[float] = None
    calories: Optional[float] = None
    avg_hr: Optional[float] = None
    max_hr: Optional[float] = None
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None
    avg_pace: Optional[float] = None
    training_load: Optional[float] = None
    training_effect: Optional[float] = None
    anaerobic_training_effect: Optional[float] = None

class ActivitiesListResponse(BaseModel):
    activities: list[Activity]
    count: int

class ActivityDetailResponse(BaseModel):
    activity: Activity
