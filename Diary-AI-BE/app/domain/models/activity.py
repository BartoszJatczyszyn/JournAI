from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional

@dataclass(frozen=True)
class Activity:
    activity_id: int
    sport: str
    start_time: Optional[datetime]
    day: Optional[date]
    distance_km: Optional[float] = None
    avg_pace: Optional[float] = None
    avg_speed: Optional[float] = None
    elapsed_time_seconds: Optional[int] = None


@dataclass(frozen=True)
class LabelCount:
    label: str
    count: int
