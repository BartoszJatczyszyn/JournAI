from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

# DB access moved to application services; direct DB imports should be avoided here
from application.services.journal_service import JournalService, AsyncJournalService
from presentation.di import di


async def get_entry(day: date) -> Dict[str, Any] | None:
    svc = AsyncJournalService()
    return await svc.get_entry(day)


async def upsert_entry(day: date, update: Dict[str, Any]) -> Dict[str, Any]:
    svc = AsyncJournalService()
    if not update:
        await svc.upsert_entry(day, {})
        row = await svc.get_entry(day)
        return {"updated": [], "ignored": [], "entry": row}
    await svc.upsert_entry(day, update)
    row = await svc.get_entry(day)
    return {"updated": list(update.keys()), "ignored": [], "entry": row}


def get_latest(create_if_missing: bool = True) -> Dict[str, Any]:
    svc = JournalService()
    return svc.get_latest(create_if_missing)


def meta() -> Dict[str, Any]:
    fields = [
        {"name": "mood", "label": "Mood", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "stress_level", "label": "Stress", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "energy_level", "label": "Energy", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "focus_level", "label": "Focus", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "productivity_score", "label": "Productivity", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "sleep_quality_rating", "label": "Sleep Quality", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "soreness_level", "label": "Soreness", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {
            "name": "social_interactions_quality",
            "label": "Social",
            "type": "rating",
            "min": 1,
            "max": 5,
            "group": "ratings",
        },
        {"name": "digestion_quality", "label": "Digestion", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {
            "name": "workout_intensity_rating",
            "label": "Workout Intensity",
            "type": "rating",
            "min": 1,
            "max": 5,
            "group": "ratings",
        },
        {"name": "hrv_manual", "label": "HRV (manual)", "type": "number", "min": 20, "max": 150, "group": "metrics"},
        {"name": "water_intake_ml", "label": "Water (ml)", "type": "number", "min": 0, "max": 20000, "group": "metrics"},
        {"name": "caffeine_mg", "label": "Caffeine (mg)", "type": "number", "min": 0, "max": 2000, "group": "metrics"},
        {"name": "fasting_hours", "label": "Fasting (h)", "type": "number", "min": 0, "max": 48, "group": "metrics"},
        {"name": "screen_time_minutes", "label": "Screen (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "outside_time_minutes", "label": "Outside (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "reading_time_minutes", "label": "Reading (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "resting_hr_manual", "label": "Resting HR (manual)", "type": "number", "min": 20, "max": 250, "group": "metrics"},
        {"name": "meditated", "label": "Meditated", "type": "bool", "group": "flags"},
        {"name": "calories_controlled", "label": "Calories Controlled", "type": "bool", "group": "flags"},
        {"name": "night_snacking", "label": "Night Snacking", "type": "bool", "group": "flags"},
        {"name": "sweet_cravings", "label": "Sweet Cravings", "type": "bool", "group": "flags"},
        {"name": "steps_goal_achieved", "label": "Steps Goal", "type": "bool", "group": "flags"},
        {"name": "journaling_done", "label": "Journaling", "type": "bool", "group": "flags"},
        {"name": "stretching_mobility_done", "label": "Mobility", "type": "bool", "group": "flags"},
        {"name": "supplement_ashwagandha", "label": "Ashwagandha", "type": "bool", "group": "supplements"},
        {"name": "supplement_magnesium", "label": "Magnesium", "type": "bool", "group": "supplements"},
        {"name": "supplement_vitamin_d", "label": "Vitamin D", "type": "bool", "group": "supplements"},
        {"name": "used_sleep_mask", "label": "Sleep Mask", "type": "bool", "group": "sleep_env"},
        {"name": "used_ear_plugs", "label": "Ear Plugs", "type": "bool", "group": "sleep_env"},
        {"name": "read_before_sleep", "label": "Read Before", "type": "bool", "group": "sleep_env"},
        {"name": "used_phone_before_sleep", "label": "Phone Before", "type": "bool", "group": "sleep_env"},
        {"name": "hot_bath_before_sleep", "label": "Hot Bath", "type": "bool", "group": "sleep_env"},
        {"name": "blue_light_blockers", "label": "Blue Blockers", "type": "bool", "group": "sleep_env"},
        {"name": "alcohol", "label": "Alcohol", "type": "text", "group": "lifestyle"},
        {"name": "supplements_taken", "label": "Supplements (list)", "type": "text", "group": "supplements"},
        {"name": "bedroom_temp_rating", "label": "Bedroom Temp", "type": "text", "group": "sleep_env"},
        {"name": "location", "label": "Location", "type": "text", "group": "context"},
        {"name": "primary_workout_type", "label": "Primary Workout", "type": "text", "group": "context"},
        {"name": "notes", "label": "Notes", "type": "text", "group": "text"},
    ]
    return {"fields": fields}


def context(day: date, window: int = 7) -> Dict[str, Any]:
    return di.journal_analytics_service().context(day, window)


def correlations(start: date, end: date, method: str = "pearson", min_abs: float = 0.0) -> Dict[str, Any]:
    return di.journal_analytics_service().correlations(start, end, method, min_abs)


def recovery_composite(
    start: date,
    end: date,
    hrv_manual_weight: float = 0.3,
    sleep_weight: float = 0.25,
    stress_weight: float = 0.2,
    energy_weight: float = 0.15,
    mood_weight: float = 0.1,
) -> Dict[str, Any]:
    return di.journal_analytics_service().recovery_composite(
        start=start,
        end=end,
        hrv_manual_weight=hrv_manual_weight,
        sleep_weight=sleep_weight,
        stress_weight=stress_weight,
        energy_weight=energy_weight,
        mood_weight=mood_weight,
    )


__all__ = [
    "get_entry",
    "upsert_entry",
    "get_latest",
    "meta",
    "context",
    "correlations",
    "recovery_composite",
]
