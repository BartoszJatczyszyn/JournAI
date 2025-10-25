#!/usr/bin/env python3
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from presentation.controllers import journal_controller as ctl

router = APIRouter(tags=["journal"], prefix="/journal")

# NOTE: Define static '/latest' route BEFORE dynamic '/{day}' to avoid FastAPI attempting
# to parse the literal string 'latest' as a date (which yields 422 validation error).
@router.get("/latest")
def get_latest_journal(create_if_missing: bool = Query(True, description="If true and today missing, create stub")):
    """Return the most recent journal entry or create a stub for today if requested."""
    try:
        res = ctl.get_latest(create_if_missing)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


# Updated allow‑list (matching new DailyJournal schema)
ALLOWED_FIELDS: set[str] = {
    # Ratings 1-5
    "mood", "stress_level", "energy_level", "focus_level", "productivity_score",
    "sleep_quality_rating", "soreness_level", "social_interactions_quality",
    "digestion_quality", "workout_intensity_rating",
    # Lifestyle flags
    "meditated", "alcohol", "fasting_hours", "calories_controlled", "night_snacking",
    "sweet_cravings", "steps_goal_achieved", "journaling_done", "stretching_mobility_done",
    # Nutrition
    "water_intake_ml", "caffeine_mg", "supplements_taken", "supplement_ashwagandha",
    "supplement_magnesium", "supplement_vitamin_d",
    # Sleep env
    "used_sleep_mask", "used_ear_plugs", "bedroom_temp_rating", "read_before_sleep",
    "used_phone_before_sleep", "hot_bath_before_sleep", "blue_light_blockers",
    # Time allocations
    "screen_time_minutes", "outside_time_minutes", "reading_time_minutes",
    # Body metrics
    # Removed weight_morning_kg (weight now stored in garmin_weight)
    "resting_hr_manual", "hrv_manual",
    # Context
    "location", "primary_workout_type", "notes",
}


class JournalUpdate(BaseModel):
    """Editable subset of DailyJournal (new schema)."""

    model_config = ConfigDict(extra="forbid")

    # Ratings 1-5
    mood: Optional[int] = Field(None, ge=1, le=5)
    stress_level: Optional[int] = Field(None, ge=1, le=5)
    energy_level: Optional[int] = Field(None, ge=1, le=5)
    focus_level: Optional[int] = Field(None, ge=1, le=5)
    productivity_score: Optional[int] = Field(None, ge=1, le=5)
    sleep_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    soreness_level: Optional[int] = Field(None, ge=1, le=5)
    social_interactions_quality: Optional[int] = Field(None, ge=1, le=5)
    digestion_quality: Optional[int] = Field(None, ge=1, le=5)
    workout_intensity_rating: Optional[int] = Field(None, ge=1, le=5)

    # Lifestyle flags / behaviors
    meditated: Optional[bool] = None
    alcohol: Optional[str] = None
    fasting_hours: Optional[float] = Field(None, ge=0, le=48)
    calories_controlled: Optional[bool] = None
    night_snacking: Optional[bool] = None
    sweet_cravings: Optional[bool] = None
    steps_goal_achieved: Optional[bool] = None
    journaling_done: Optional[bool] = None
    stretching_mobility_done: Optional[bool] = None

    # Nutrition
    water_intake_ml: Optional[int] = Field(None, ge=0, le=20000)
    caffeine_mg: Optional[int] = Field(None, ge=0, le=2000)
    supplements_taken: Optional[str] = None
    supplement_ashwagandha: Optional[bool] = None
    supplement_magnesium: Optional[bool] = None
    supplement_vitamin_d: Optional[bool] = None

    # Sleep env
    used_sleep_mask: Optional[bool] = None
    used_ear_plugs: Optional[bool] = None
    bedroom_temp_rating: Optional[str] = None
    read_before_sleep: Optional[bool] = None
    used_phone_before_sleep: Optional[bool] = None
    hot_bath_before_sleep: Optional[bool] = None
    blue_light_blockers: Optional[bool] = None

    # Time allocations
    screen_time_minutes: Optional[int] = Field(None, ge=0, le=1440)
    outside_time_minutes: Optional[int] = Field(None, ge=0, le=1440)
    reading_time_minutes: Optional[int] = Field(None, ge=0, le=1440)

    # Body metrics
    # weight_morning_kg removed (weight comes from device table)
    resting_hr_manual: Optional[int] = Field(None, ge=20, le=250)
    hrv_manual: Optional[int] = Field(None, ge=20, le=150)

    # Context
    location: Optional[str] = None
    primary_workout_type: Optional[str] = None
    notes: Optional[str] = None

    def to_update_dict(self) -> Dict[str, Any]:
        data = self.model_dump(exclude_unset=True)
        return {k: v for k, v in data.items() if v is not None}


@router.get("/{day}")
async def get_journal_entry(day: date):
    row = await ctl.get_entry(day)
    if not row:
        raise HTTPException(status_code=404, detail="journal entry not found")
    return row




@router.put("/{day}")
async def upsert_journal_entry(day: date, payload: JournalUpdate):
    update_dict = payload.to_update_dict()
    filtered: Dict[str, Any] = {k: v for k, v in update_dict.items() if k in ALLOWED_FIELDS}
    res = await ctl.upsert_entry(day, filtered)
    ignored: List[str] = [k for k in update_dict.keys() if k not in filtered]
    res["ignored"] = ignored
    return res


# helpers moved to controller


@router.get("/meta")
def journal_meta():
    return ctl.meta()


@router.get("/context/{day}")
def journal_context(day: date, window: int = Query(7, ge=3, le=30)):
    try:
        return ctl.context(day, window)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/correlations")
def journal_correlations(
    start: date = Query(..., description="Start date inclusive"),
    end: date = Query(..., description="End date inclusive"),
    method: str = Query("pearson", pattern="^(pearson|spearman)$"),
    min_abs: float = Query(0.0, ge=0.0, le=1.0, description="Minimum absolute correlation to include in pairs list"),
):
    """Compute correlation matrix across manual journal & derived metrics.

    method: 'pearson' (linear) or 'spearman' (rank).
    Filters out columns with < 5 non-null observations.
    Returns matrix + long-form pairs for convenient frontend visualization.
    """
    try:
        return ctl.correlations(start, end, method, min_abs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recovery_composite")
def recovery_composite(
    start: date = Query(...),
    end: date = Query(...),
    hrv_manual_weight: float = Query(0.3, ge=0, le=1, description="Weight for manual HRV (hrv_manual)"),
    sleep_weight: float = Query(0.25, ge=0, le=1),
    stress_weight: float = Query(0.2, ge=0, le=1),
    energy_weight: float = Query(0.15, ge=0, le=1),
    mood_weight: float = Query(0.1, ge=0, le=1),
):
    """Return per-day recovery composite score (0-100) using hrv_manual instead of hrv_ms.

    Normalization:
      hrv_manual: clip 20..150 -> (x-20)/130
      ratings (sleep_quality_rating, stress_level, energy_level, mood): value/5
      stress is inverted when contributing (higher stress lowers recovery).
    Missing components are skipped with weight renormalization.
    """
    try:
        return ctl.recovery_composite(
            start,
            end,
            hrv_manual_weight,
            sleep_weight,
            stress_weight,
            energy_weight,
            mood_weight,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
