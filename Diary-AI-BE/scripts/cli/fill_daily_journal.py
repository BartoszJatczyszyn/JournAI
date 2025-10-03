#!/usr/bin/env python3
"""
Fill daily_journal with 300 days of synthetic-but-plausible data, setting all columns.

Now with smarter generators for specific fields:
- Correlated metrics (sleep_quality, stress_level, energy_level, mood, productivity_level)
- Seasonal bedroom_temp_rating, weekend alcohol, weekday office, gym cadence
- Phone vs reading trade-off, calories control vs cravings/night snacking
- HRV related to sleep and stress

Safe to re-run: uses INSERT ... ON CONFLICT(day) DO UPDATE.

Usage:
  python AI/temp_dailyJournal                 # dry-run (rolls back)
  python AI/temp_dailyJournal --commit        # write changes
  python AI/temp_dailyJournal --days 180 --commit

Requirements:
- Postgres reachable and daily_journal exists
- DB config in AI/Diary-AI-BE/config.env (or env vars)
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, time, timedelta
from pathlib import Path
import random
import sys
from typing import Any, Dict, List, Tuple

# Reuse project DB helper
SCRIPTS_DIR = Path(__file__).resolve().parent / "Diary-AI-BE" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from db import get_connection  # type: ignore

# Constants and helper sets
RATING_FIELDS = {
    "energy_level",
    "productivity_level",
    "stress_level_manual",
    "sleep_quality_manual",
}
BOOL_HINTS = {
    "meditated",
    "calories_controlled",
    "sweet_cravings",
    "night_snacking",
    "supplement_ashwagandha",
    "supplement_magnesium",
    "supplement_vitamin_d",
    "used_sleep_mask",
    "used_ear_plugs",
    "read_before_sleep",
    "used_phone_before_sleep",
    "hot_bath_before_sleep",
}
TEMP_CHOICES = ["cold", "cool", "comfortable", "warm", "hot"]
LOC_WEEKDAY = ["office", "home", "gym", "home", "office"]
LOC_WEEKEND = ["home", "outdoors", "travel", "home"]
ALCOHOL_WEEKDAY = ["none", "none", "none", "low"]
ALCOHOL_WEEKEND = ["none", "beer", "wine", "spirits", "low"]
MOOD_LABELS = ["terrible", "bad", "okay", "good", "great"]


def deterministic_rng(key: str) -> random.Random:
    r = random.Random()
    r.seed(key)
    return r


def fetch_columns() -> List[Tuple[str, str, str]]:
    """Return list of (column_name, data_type, is_nullable)."""
    q = (
        "SELECT column_name, data_type, is_nullable "
        "FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = 'daily_journal' "
        "ORDER BY ordinal_position"
    )
    with get_connection() as conn:  # type: ignore
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(q)
            return [(r[0], r[1], r[2]) for r in cur.fetchall()]


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def score_1_5(x: float) -> int:
    return int(clamp(round(x), 1, 5))


def steps_to_score(steps: int) -> int:
    if steps >= 12000:
        return 5
    if steps >= 9000:
        return 4
    if steps >= 6000:
        return 3
    if steps >= 4000:
        return 2
    return 1


def sleep_score_to_quality(sleep_score: float) -> int:
    if sleep_score >= 85:
        return 5
    if sleep_score >= 75:
        return 4
    if sleep_score >= 65:
        return 3
    if sleep_score >= 50:
        return 2
    return 1


def season_from_month(m: int) -> str:
    return ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][m - 1]


def seasonal_temp_label(month: int, rnd: random.Random) -> str:
    season = season_from_month(month)
    if season == "winter":
        return rnd.choices(["cold", "cool", "comfortable"], weights=[5, 3, 2])[0]
    if season == "summer":
        return rnd.choices(["comfortable", "warm", "hot"], weights=[3, 4, 3])[0]
    # spring/autumn
    return rnd.choices(["cool", "comfortable", "warm"], weights=[3, 5, 2])[0]


def build_row(cols: List[Tuple[str, str, str]], day: date, idx: int) -> Dict[str, Any]:
    """Generate a coherent row of values for a given day with correlations.
    Known field semantics are respected; unknown fields use type-based defaults.
    """
    rng = deterministic_rng(f"rowseed-{day.isoformat()}")
    weekday = day.weekday()  # 0=Mon..6=Sun
    is_weekend = weekday >= 5
    month = day.month

    # Underlying latent variables for the day
    # Steps: weekday cadence + slight trend + noise
    steps_base = 6500 + (weekday * 300) + (idx % 14) * 40
    steps_jitter = rng.randint(-800, 1200)
    steps = int(max(500, steps_base + steps_jitter))
    steps_score = steps_to_score(steps)

    # Sleep score: moderate band with jitter and weekend relief
    sleep_score = clamp(72 + rng.randint(-12, 15) + (3 if not is_weekend else 5), 40, 96)
    sleep_quality = sleep_score_to_quality(sleep_score)

    # Stress level manual (1=low, 5=high): higher weekdays, mitigated by meditation later
    stress_raw = 3.0 + (0.5 if not is_weekend else -0.2) + (2 - sleep_quality) * 0.5 + rng.uniform(-0.4, 0.6)
    stress_level = score_1_5(stress_raw)

    # Meditation habit: more on weekdays
    meditated = (rng.random() < (0.45 if not is_weekend else 0.25))
    if meditated:
        stress_level = score_1_5(stress_level - 0.4)

    # Energy level prefers sleep + steps, penalize stress
    energy_raw = 0.55 * sleep_quality + 0.30 * steps_score + 0.15 * (5 - stress_level) + rng.uniform(-0.25, 0.25)
    energy_level = score_1_5(energy_raw)

    # Mood prefers sleep(+steps) and weekend bump, penalize stress
    mood_raw = 0.50 * sleep_quality + 0.25 * steps_score + 0.10 * (5 - stress_level) + (0.3 if is_weekend else 0) + rng.uniform(-0.3, 0.3)
    mood_num = score_1_5(mood_raw)

    # Productivity ~ average of energy and mood, slightly lower on weekends
    productivity_raw = (energy_level + mood_num) / 2 + (-0.3 if is_weekend else 0) + rng.uniform(-0.2, 0.2)
    productivity_level = score_1_5(productivity_raw)

    # HRV ms rises with better sleep and lower stress
    hrv_ms = int(clamp(45 + 2.0 * (sleep_quality - 3) - 2.0 * (stress_level - 3) + rng.uniform(-4, 4), 20, 110))

    # Food discipline and cravings
    calories_controlled = (rng.random() < (0.6 if not is_weekend else 0.4))
    sweet_cravings = (rng.random() < (0.25 if calories_controlled else 0.45))
    night_snacking = sweet_cravings and (sleep_quality <= 2) and (rng.random() < 0.6)

    # Evening habits
    read_before_sleep = (rng.random() < (0.55 if not is_weekend else 0.35))
    used_phone_before_sleep = (not read_before_sleep) and (rng.random() < (0.45 if is_weekend else 0.35))
    hot_bath_before_sleep = (rng.random() < 0.12)

    # Sleep environment
    used_sleep_mask = (rng.random() < 0.35)
    used_ear_plugs = (rng.random() < 0.25)
    bedroom_temp_rating = seasonal_temp_label(month, rng)

    # Supplements
    supplement_ashwagandha = (rng.random() < 0.3)
    supplement_magnesium = (rng.random() < 0.5)
    vitamin_winter = season_from_month(month) == "winter"
    supplement_vitamin_d = (rng.random() < (0.55 if vitamin_winter else 0.25))
    supplements_list = []
    if supplement_ashwagandha:
        supplements_list.append("ashwagandha")
    if supplement_magnesium:
        supplements_list.append("magnesium")
    if supplement_vitamin_d:
        supplements_list.append("vitamin_d")
    supplements_taken = ", ".join(supplements_list) if supplements_list else None

    # Time-of-day details
    def _pick_time(start_h: int, end_h: int) -> time:
        h = rng.randint(start_h, end_h)
        m = rng.choice([0, 10, 15, 20, 30, 40, 45, 50])
        return time(hour=h, minute=m)

    # Alcohol time: evenings; slightly later on weekends
    alcohol_time = _pick_time(19, 23 if is_weekend else 22)

    # Last meal time: earlier if calories controlled; a bit later on weekends
    if calories_controlled:
        last_meal_time = _pick_time(18, 20)
    else:
        last_meal_time = _pick_time(19, 21 if not is_weekend else 22)

    # Last caffeine time: earlier if calories controlled; weekends allow later
    if calories_controlled:
        last_caffeine_time = _pick_time(10, 15)
    else:
        last_caffeine_time = _pick_time(10, 17 if is_weekend else 16)

    # Context
    if is_weekend:
        alcohol = rng.choice(ALCOHOL_WEEKEND if rng.random() < 0.35 else ["none", "low"])
        location = rng.choice(LOC_WEEKEND)
    else:
        alcohol = rng.choice(ALCOHOL_WEEKDAY)
        location = rng.choice(LOC_WEEKDAY)

    # Construct base known field map (we'll adapt to actual column dtypes later)
    base: Dict[str, Any] = {
        "day": day,
        "sleep_quality_manual": sleep_quality,
        "stress_level_manual": stress_level,
        "energy_level": energy_level,
        "productivity_level": productivity_level,
        "hrv_ms": hrv_ms,
        "calories_controlled": calories_controlled,
        "sweet_cravings": sweet_cravings,
        "night_snacking": night_snacking,
        "meditated": meditated,
        "read_before_sleep": read_before_sleep,
        "used_phone_before_sleep": used_phone_before_sleep,
        "hot_bath_before_sleep": hot_bath_before_sleep,
        "used_sleep_mask": used_sleep_mask,
        "used_ear_plugs": used_ear_plugs,
        "bedroom_temp_rating": bedroom_temp_rating,
        "supplement_ashwagandha": supplement_ashwagandha,
        "supplement_magnesium": supplement_magnesium,
        "supplement_vitamin_d": supplement_vitamin_d,
        "supplements_taken": supplements_taken,
        "location": location,
        "alcohol": alcohol,
        "alcohol_time": alcohol_time,
        "last_meal_time": last_meal_time,
        "last_caffeine_time": last_caffeine_time,
        # Helpful text fields if present
        "notes": f"Auto-filled: sleepQ={sleep_quality}, stress={stress_level}, energy={energy_level}, moodN={mood_num}",
        "tags": f"auto,seeded,{'weekend' if is_weekend else 'weekday'}",
        # Time-ish fields
        "created_at": datetime.combine(day, time(hour=8, minute=0)),
        "updated_at": datetime.combine(day, time(hour=20, minute=0)),
    }

    # Now adapt to table schema and fill remaining/unknown columns
    dtype_map = {name: dtype for name, dtype, _ in cols}

    # Mood may be numeric or textual depending on schema
    if "mood" in dtype_map:
        if dtype_map["mood"] in ("integer", "bigint", "smallint", "numeric", "real", "double precision"):
            base["mood"] = mood_num
        else:
            base["mood"] = MOOD_LABELS[mood_num - 1]

    # Provide generic values for any other columns not covered above
    for name, dtype, _ in cols:
        if name in base:
            continue
        # Timestamp-ish
        if "timestamp" in dtype:
            base[name] = datetime.combine(day, time(hour=12))
            continue
        # Dates
        if dtype == "date":
            base[name] = day
            continue
        # Booleans or hinted
        if dtype == "boolean" or name in BOOL_HINTS:
            base[name] = bool(deterministic_rng(f"{name}-{day}").randint(0, 1))
            continue
        # Integers
        if dtype in {"integer", "bigint", "smallint"}:
            if name in RATING_FIELDS:
                base[name] = score_1_5(3 + deterministic_rng(f"{name}-{day}").randint(-2, 2))
            elif name.lower().endswith("_pct"):
                base[name] = deterministic_rng(f"{name}-{day}").randint(0, 100)
            elif name.lower().endswith("_minutes") or name.lower().endswith("_min"):
                base[name] = deterministic_rng(f"{name}-{day}").randint(0, 600)
            elif name.lower().startswith("hrv") or name == "hrv_ms":
                base[name] = hrv_ms
            else:
                base[name] = deterministic_rng(f"{name}-{day}").randint(0, 100)
            continue
        # Numerics
        if dtype in {"numeric", "real", "double precision"}:
            if name.endswith("_score"):
                base[name] = float(deterministic_rng(f"{name}-{day}").randint(40, 95))
            else:
                base[name] = round(deterministic_rng(f"{name}-{day}").uniform(0, 100), 2)
            continue
        # Text
        if dtype in {"character varying", "text"}:
            if name == "bedroom_temp_rating":
                base[name] = bedroom_temp_rating
            elif name == "alcohol":
                base[name] = alcohol
            elif name == "location":
                base[name] = location
            elif name == "notes":
                base[name] = base.get("notes")
            elif name == "tags":
                base[name] = base.get("tags")
            else:
                base[name] = f"{name} value {idx}"
            continue
        # JSON/JSONB
        if dtype in {"json", "jsonb"}:
            base[name] = {"source": "temp_dailyJournal", "day": day.isoformat()}
            continue
        # Fallback
        base[name] = None

    return base


def upsert_rows(days: int, commit: bool) -> None:
    cols = fetch_columns()
    if not cols:
        raise SystemExit("daily_journal has no columns or does not exist")
    if "day" not in [c[0] for c in cols]:
        raise SystemExit("daily_journal must contain a 'day' column")

    today = date.today()
    start = today - timedelta(days=days - 1)

    with get_connection() as conn:  # type: ignore
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            for idx in range(days):
                d = start + timedelta(days=idx)
                row = build_row(cols, d, idx)
                # Keep only columns that actually exist in the table schema
                row = {name: row.get(name) for (name, _, _) in cols}

                # Ensure the referenced day exists in garmin_daily_summaries to satisfy FK constraint
                try:
                    cur.execute("INSERT INTO garmin_daily_summaries (day) VALUES (%s) ON CONFLICT(day) DO NOTHING", (d,))
                except Exception:
                    # If the table doesn't exist or permission denied, continue and let the original insert fail
                    pass

                insert_cols = list(row.keys())
                placeholders = ", ".join(["%s"] * len(insert_cols))
                col_list = ", ".join(insert_cols)
                update_cols = [c for c in insert_cols if c != "day"]
                set_clause = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])

                sql = (
                    f"INSERT INTO daily_journal ({col_list}) VALUES ({placeholders}) "
                    f"ON CONFLICT(day) DO UPDATE SET {set_clause}"
                )
                cur.execute(sql, [row[c] for c in insert_cols])

            if commit:
                conn.commit()
            else:
                conn.rollback()

    print(f"Prepared {days} day rows from {start} to {today}. {'Committed changes.' if commit else 'Dry-run (rolled back).'}")


def main() -> None:
    p = argparse.ArgumentParser(description="Fill daily_journal with coherent synthetic data for last N days (default 300)")
    p.add_argument("--days", type=int, default=300, help="Number of days to fill")
    p.add_argument("--commit", action="store_true", help="Commit changes (otherwise dry-run)")
    args = p.parse_args()

    upsert_rows(days=max(1, args.days), commit=args.commit)


if __name__ == "__main__":
    main()
