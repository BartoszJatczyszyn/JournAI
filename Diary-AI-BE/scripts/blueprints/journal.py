#!/usr/bin/env python3
"""Journal (daily_journal) CRUD endpoints.

Provides minimal GET + PUT (upsert) operations used by the React frontend
(`/api/journal/{day}`). The underlying dynamic SQL lives in
`services/journal_service.py`.

Design notes:
  * We keep the response shape simple: the raw row dict (or 404 if missing)
  * PUT filters incoming JSON to a safe allow‑list of known columns
  * Unknown / disallowed keys are ignored (reported back for transparency)
  * Returns the updated row after successful upsert
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from services.journal_service import JournalService

router = APIRouter(tags=["journal"], prefix="/journal")

# NOTE: Define static '/latest' route BEFORE dynamic '/{day}' to avoid FastAPI attempting
# to parse the literal string 'latest' as a date (which yields 422 validation error).
@router.get("/latest")
def get_latest_journal(create_if_missing: bool = Query(True, description="If true and today missing, create stub")):
    """Return the most recent journal entry.

    Logic:
      * Try today's entry first.
      * Else return most recent historical day.
      * If none exist and create_if_missing=True, create stub for today.
    """
    from db import execute_query  # local import
    today = date.today()
    svc = JournalService()
    current = svc.get_entry(today)
    if current:
        return {"day": current.get("day"), "entry": current, "is_today": True, "created": False}
    latest_row = execute_query("SELECT * FROM daily_journal ORDER BY day DESC LIMIT 1", (), fetch_one=True)
    if latest_row and latest_row.get("day"):
        try:
            latest_row["day"] = latest_row["day"].isoformat()
        except Exception:
            pass
        return {"day": latest_row.get("day"), "entry": latest_row, "is_today": False, "created": False}
    if create_if_missing:
        svc.upsert_entry(today, {})
        stub = svc.get_entry(today)
        return {"day": stub.get("day") if stub else today.isoformat(), "entry": stub or {"day": today.isoformat()}, "is_today": True, "created": True}
    raise HTTPException(status_code=404, detail="no journal entries yet")


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
def get_journal_entry(day: date):
    svc = JournalService()
    row = svc.get_entry(day)
    if not row:
        raise HTTPException(status_code=404, detail="journal entry not found")
    return row




@router.put("/{day}")
def upsert_journal_entry(day: date, payload: JournalUpdate):
    svc = JournalService()
    update_dict = payload.to_update_dict()

    # Filter by allow‑list (silently ignore unknowns already prevented by Pydantic)
    filtered: Dict[str, Any] = {k: v for k, v in update_dict.items() if k in ALLOWED_FIELDS}

    if not filtered:
        # Ensure a stub row exists even if no (valid) fields supplied
        svc.upsert_entry(day, {})
        row = svc.get_entry(day)
        return {"updated": [], "ignored": list(update_dict.keys()), "entry": row}

    svc.upsert_entry(day, filtered)
    row = svc.get_entry(day)
    ignored: List[str] = [k for k in update_dict.keys() if k not in filtered]
    return {"updated": list(filtered.keys()), "ignored": ignored, "entry": row}


def _fetch_last_days(day: date, window: int = 7) -> list[dict[str, Any]]:
    from db import execute_query  # local import to avoid import cycles
    query = """
        SELECT day, mood, stress_level, energy_level, focus_level, productivity_score,
               sleep_quality_rating, soreness_level, social_interactions_quality,
               digestion_quality, workout_intensity_rating, hrv_manual, resting_hr_manual
        FROM daily_journal
        WHERE day BETWEEN %s - INTERVAL '%s day' AND %s
        ORDER BY day
    """
    rows = execute_query(query, (day, window - 1, day), fetch_all=True) or []
    for r in rows:
        d = r.get("day")
        if d and hasattr(d, "isoformat"):
            r["day"] = d.isoformat()
    return rows


def _predict_energy(last_rows: list[dict[str, Any]]) -> float | None:
    values = [r.get("energy_level") for r in last_rows if r.get("energy_level") is not None]
    if not values:
        return None
    recent = values[-3:] if len(values) >= 3 else values
    avg = sum(recent) / len(recent)
    # Midpoint of new 1-5 scale is 3.0 (previously 5.0 for 0-10)
    return round(avg * 0.85 + 3.0 * 0.15, 2)  # light regression toward midpoint 3


def _suggest_field(field: str, rows: list[dict[str, Any]], current: dict[str, Any]) -> float | None:
    hist = [r.get(field) for r in rows[:-1] if r.get(field) is not None]
    if not hist:
        return None
    base_avg = sum(hist[-5:]) / min(5, len(hist))
    cur = current.get(field)
    # For 1-5 scale a difference of >=1 is meaningful (was 2 for 0-10)
    if cur is None or abs(cur - base_avg) >= 1:
        return round(base_avg, 2)
    return None


def _generate_summary(entry: dict[str, Any], pred: float | None) -> str:
    parts: list[str] = []
    mood = entry.get("mood")
    energy = entry.get("energy_level")
    stress = entry.get("stress_level")
    sleepq = entry.get("sleep_quality_rating")
    productivity = entry.get("productivity_score")
    # thresholds adjusted for 1-5 scale
    if energy is not None and mood is not None:
        if energy >= 4 and mood >= 4:
            parts.append("High energy & mood")
        elif energy <= 2 and mood <= 2:
            parts.append("Low energy & mood — rest")
        elif energy >= 4 and mood <= 2:
            parts.append("Energy > mood (mental recovery?)")
    if stress is not None and stress >= 4:
        parts.append("Elevated stress")
    if sleepq is not None and energy is not None:
        if sleepq >= 4 and energy <= 2:
            parts.append("Good sleep but low energy")
        elif sleepq <= 2 and energy >= 4:
            parts.append("Poor sleep yet good energy")
    if productivity is not None and energy is not None and (productivity - energy) >= 2:
        parts.append("High productivity vs energy")
    if pred is not None:
        if pred <= 2:
            parts.append("Tomorrow energy forecast low")
        elif pred >= 4:
            parts.append("Tomorrow energy forecast high")
    return "; ".join(parts) if parts else "Stable day."


@router.get("/meta")
def journal_meta():
    fields = [
        {"name": "mood", "label": "Mood", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "stress_level", "label": "Stress", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "energy_level", "label": "Energy", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "focus_level", "label": "Focus", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "productivity_score", "label": "Productivity", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "sleep_quality_rating", "label": "Sleep Quality", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "soreness_level", "label": "Soreness", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "social_interactions_quality", "label": "Social", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "digestion_quality", "label": "Digestion", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
        {"name": "workout_intensity_rating", "label": "Workout Intensity", "type": "rating", "min": 1, "max": 5, "group": "ratings"},
    {"name": "hrv_manual", "label": "HRV (manual)", "type": "number", "min": 20, "max": 150, "group": "metrics"},
        # weight_morning_kg removed from manual journal meta
        {"name": "water_intake_ml", "label": "Water (ml)", "type": "number", "min": 0, "max": 20000, "group": "metrics"},
        {"name": "caffeine_mg", "label": "Caffeine (mg)", "type": "number", "min": 0, "max": 2000, "group": "metrics"},
        {"name": "fasting_hours", "label": "Fasting (h)", "type": "number", "min": 0, "max": 48, "group": "metrics"},
        {"name": "screen_time_minutes", "label": "Screen (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "outside_time_minutes", "label": "Outside (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "reading_time_minutes", "label": "Reading (min)", "type": "number", "min": 0, "max": 1440, "group": "metrics"},
        {"name": "resting_hr_manual", "label": "Resting HR (manual)", "type": "number", "min": 20, "max": 250, "group": "metrics"},
        # Booleans
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
        # Textual
        {"name": "alcohol", "label": "Alcohol", "type": "text", "group": "lifestyle"},
        {"name": "supplements_taken", "label": "Supplements (list)", "type": "text", "group": "supplements"},
        {"name": "bedroom_temp_rating", "label": "Bedroom Temp", "type": "text", "group": "sleep_env"},
        {"name": "location", "label": "Location", "type": "text", "group": "context"},
        {"name": "primary_workout_type", "label": "Primary Workout", "type": "text", "group": "context"},
        {"name": "notes", "label": "Notes", "type": "text", "group": "text"},
    ]
    return {"fields": fields}


@router.get("/context/{day}")
def journal_context(day: date, window: int = Query(7, ge=3, le=30)):
    svc = JournalService()
    entry = svc.get_entry(day) or {"day": day.isoformat()}
    rows = _fetch_last_days(day, window)
    if rows and rows[-1].get("day") != entry.get("day"):
        rows.append(entry)
    prediction = _predict_energy(rows)
    suggestion_targets = [
        "mood", "stress_level", "energy_level", "focus_level", "productivity_score",
        "sleep_quality_rating", "soreness_level", "social_interactions_quality",
        "digestion_quality", "workout_intensity_rating",
    ]
    suggestions: dict[str, float] = {}
    for f in suggestion_targets:
        s = _suggest_field(f, rows, entry)
        if s is not None:
            suggestions[f] = s
    # Build time series
    series: dict[str, list[dict[str, Any]]] = {}
    for f in suggestion_targets:
        seq = []
        for r in rows:
            if r.get(f) is not None:
                seq.append({"day": r["day"], "value": r.get(f)})
        if seq:
            series[f] = seq[-window:]
    considered = suggestion_targets + ["hrv_manual", "resting_hr_manual"]
    filled = sum(1 for f in considered if entry.get(f) is not None)
    completeness = round(100 * filled / len(considered), 1) if considered else 0.0
    summary = _generate_summary(entry, prediction)
    return {
        "day": entry.get("day"),
        "entry": entry,
        "last_window": series,
        "predicted": {"energy_level": prediction},
        "suggestions": suggestions,
        "summary_text": summary,
        "completeness_pct": completeness,
        "window": window,
    }


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
    from db import execute_query
    import pandas as pd  # type: ignore
    import numpy as np  # type: ignore

    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")

    query = """
        SELECT day,
               mood, stress_level, energy_level, focus_level, productivity_score,
               sleep_quality_rating, soreness_level, social_interactions_quality,
               digestion_quality, workout_intensity_rating,
               hrv_manual, resting_hr_manual,
               water_intake_ml, caffeine_mg, fasting_hours,
               screen_time_minutes, outside_time_minutes, reading_time_minutes,
               meditated::int, calories_controlled::int, night_snacking::int, sweet_cravings::int,
               steps_goal_achieved::int, journaling_done::int, stretching_mobility_done::int
        FROM daily_journal
        WHERE day BETWEEN %s AND %s
        ORDER BY day
    """
    rows = execute_query(query, (start, end), fetch_all=True) or []
    if not rows:
        return {"matrix": {}, "pairs": [], "count": 0}

    df = pd.DataFrame(rows)
    numeric_cols = [
        c for c in df.columns if c != "day" and pd.api.types.is_numeric_dtype(df[c])
    ]
    # drop columns with insufficient data
    sufficient = [c for c in numeric_cols if df[c].dropna().shape[0] >= 5]
    if not sufficient:
        return {"matrix": {}, "pairs": [], "count": 0}

    corr = df[sufficient].corr(method=method)
    # Per-column non-null counts
    samples_per_column = {c: int(df[c].dropna().shape[0]) for c in sufficient}
    matrix = {}
    for c in corr.columns:
        matrix[c] = {}
        for r_col, v in corr[c].items():
            matrix[c][r_col] = (None if pd.isna(v) else float(round(v, 4)))

    # Category classification for frontend filtering
    rating_cols = {
        "mood", "stress_level", "energy_level", "focus_level", "productivity_score",
        "sleep_quality_rating", "soreness_level", "social_interactions_quality",
        "digestion_quality", "workout_intensity_rating",
    }
    metric_cols = {
    "hrv_manual", "resting_hr_manual", "water_intake_ml", "caffeine_mg",
        "fasting_hours", "screen_time_minutes", "outside_time_minutes", "reading_time_minutes",
    }
    flag_cols = {
        "meditated", "calories_controlled", "night_snacking", "sweet_cravings",
        "steps_goal_achieved", "journaling_done", "stretching_mobility_done",
    }
    categories: dict[str, str] = {}
    for c in sufficient:
        if c in rating_cols:
            categories[c] = "ratings"
        elif c in metric_cols:
            categories[c] = "metrics"
        elif c in flag_cols:
            categories[c] = "flags"
        else:
            categories[c] = "other"

    pairs = []
    for i, c1 in enumerate(corr.columns):
        for c2 in corr.columns[i + 1:]:
            v = corr.loc[c1, c2]
            if pd.isna(v):
                continue
            # Pairwise overlapping samples count
            n_pair = int(df[[c1, c2]].dropna().shape[0])
            v_round = float(round(v, 4))
            if abs(v_round) < min_abs:
                continue
            pairs.append({"a": c1, "b": c2, "value": v_round, "n": n_pair})

    return {
        "matrix": matrix,
        "pairs": pairs,
        "count": len(df),
        "columns": sufficient,
        "method": method,
        "samples_per_column": samples_per_column,
        "categories": categories,
        "min_abs": min_abs,
    }


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
    from db import execute_query
    import pandas as pd  # type: ignore

    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    weights = [hrv_manual_weight, sleep_weight, stress_weight, energy_weight, mood_weight]
    if sum(weights) <= 0:
        raise HTTPException(status_code=400, detail="weights must sum > 0")
    total_w = sum(weights)
    w_hrv_manual, w_sleep, w_stress, w_energy, w_mood = [w / total_w for w in weights]

    query = """
        SELECT day, hrv_manual, sleep_quality_rating, stress_level, energy_level, mood
        FROM daily_journal
        WHERE day BETWEEN %s AND %s
        ORDER BY day
    """
    rows = execute_query(query, (start, end), fetch_all=True) or []
    if not rows:
        return {"data": [], "count": 0}
    df = pd.DataFrame(rows)

    def norm_series(series, fn):
        return series.apply(lambda x: fn(x) if x is not None else None)

    def norm_hrv_manual(x):
        if x is None:
            return None
        x2 = max(20, min(150, x))
        return (x2 - 20) / 130.0

    df['hrv_manual_norm'] = norm_series(df.get('hrv_manual'), norm_hrv_manual)
    df['sleep_norm'] = norm_series(df.get('sleep_quality_rating'), lambda v: v / 5.0 if v is not None else None)
    df['energy_norm'] = norm_series(df.get('energy_level'), lambda v: v / 5.0 if v is not None else None)
    df['mood_norm'] = norm_series(df.get('mood'), lambda v: v / 5.0 if v is not None else None)
    df['stress_norm'] = norm_series(df.get('stress_level'), lambda v: v / 5.0 if v is not None else None)

    scores = []
    for _, row in df.iterrows():
        hrv_n = row.get('hrv_manual_norm')
        slp_n = row.get('sleep_norm')
        str_n = row.get('stress_norm')
        eng_n = row.get('energy_norm')
        mood_n = row.get('mood_norm')
        comp = []
        dyn_weights = []
        if hrv_n is not None:
            comp.append(hrv_n); dyn_weights.append(w_hrv_manual)
        if slp_n is not None:
            comp.append(slp_n); dyn_weights.append(w_sleep)
        if str_n is not None:
            comp.append(1 - str_n); dyn_weights.append(w_stress)
        if eng_n is not None:
            comp.append(eng_n); dyn_weights.append(w_energy)
        if mood_n is not None:
            comp.append(mood_n); dyn_weights.append(w_mood)
        if not comp:
            score = None
        else:
            w_sum = sum(dyn_weights)
            normed_weights = [w / w_sum for w in dyn_weights]
            score = sum(c * w for c, w in zip(comp, normed_weights)) * 100.0
        scores.append(score)

    df['recovery_score'] = scores
    out = []
    for _, row in df.iterrows():
        out.append({
            "day": row['day'].isoformat() if hasattr(row['day'], 'isoformat') else row['day'],
            "recovery_score": (None if row['recovery_score'] is None else round(float(row['recovery_score']), 2)),
            "components": {
                "hrv_manual_norm": row.get('hrv_manual_norm'),
                "sleep_norm": row.get('sleep_norm'),
                "energy_norm": row.get('energy_norm'),
                "mood_norm": row.get('mood_norm'),
                "stress_norm": row.get('stress_norm'),
            }
        })

    return {
        "data": out,
        "weights": {
            "hrv_manual": w_hrv_manual,
            "sleep_quality_rating": w_sleep,
            "stress_level": w_stress,
            "energy_level": w_energy,
            "mood": w_mood,
        },
        "count": len(out)
    }

__all__ = ["router"]
