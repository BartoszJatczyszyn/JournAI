#!/usr/bin/env python3
from __future__ import annotations

from typing import Dict, List

from app.db import execute_query


MUSCLE_GROUPS = [
    {"name": "Chest"},
    {"name": "Back - Width"},
    {"name": "Back - Thickness"},
    {"name": "Shoulders - Anterior Head"},
    {"name": "Shoulders - Lateral Head"},
    {"name": "Shoulders - Posterior Head"},
    {"name": "Biceps"},
    {"name": "Triceps"},
    {"name": "Quadriceps"},
    {"name": "Hamstrings"},
    {"name": "Glutes"},
    {"name": "Calves"},
    {"name": "Core - Abs"},
    {"name": "Core - Lower Back"},
    {"name": "Forearms"},
]


EXERCISES = [
    {
        "name": "Box Jump",
        "primary": "Quadriceps",
        "secondary": ["Glutes", "Hamstrings", "Calves"],
        "equipment": "other",
        "etype": "compound",
    },
    {
        "name": "Barbell Back Squat",
        "primary": "Quadriceps",
        "secondary": ["Glutes", "Hamstrings", "Core - Lower Back"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Barbell Hip Thrust with Bench",
        "primary": "Glutes",
        "secondary": ["Hamstrings", "Core - Lower Back"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Weighted Leg Curl",
        "primary": "Hamstrings",
        "secondary": [],
        "equipment": "machine",
        "etype": "isolation",
    },
    {
        "name": "Single-leg Standing Calf Raise",
        "primary": "Calves",
        "secondary": [],
        "equipment": "bodyweight",
        "etype": "isolation",
    },
    {
        "name": "Kneeling Ab Wheel",
        "primary": "Core - Abs",
        "secondary": ["Shoulders - Anterior Head", "Back - Width"],
        "equipment": "other",
        "etype": "compound",
    },
    {
        "name": "Barbell Bench Press",
        "primary": "Chest",
        "secondary": ["Triceps", "Shoulders - Anterior Head"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Incline Dumbbell Bench Press",
        "primary": "Chest",
        "secondary": ["Shoulders - Anterior Head", "Triceps"],
        "equipment": "dumbbell",
        "etype": "compound",
    },
    {
        "name": "Seated Cable Row",
        "primary": "Back - Thickness",
        "secondary": ["Back - Width", "Biceps", "Shoulders - Posterior Head"],
        "equipment": "cable",
        "etype": "compound",
    },
    {
        "name": "Arnold Press",
        "primary": "Shoulders - Anterior Head",
        "secondary": ["Shoulders - Lateral Head", "Triceps"],
        "equipment": "dumbbell",
        "etype": "compound",
    },
    {
        "name": "Chin-up",
        "primary": "Back - Width",
        "secondary": ["Biceps", "Forearms"],
        "equipment": "bodyweight",
        "etype": "compound",
    },
    {
        "name": "Face Pull",
        "primary": "Shoulders - Posterior Head",
        "secondary": ["Back - Thickness"],
        "equipment": "cable",
        "etype": "isolation",
    },
    {
        "name": "Barbell Front Squat",
        "primary": "Quadriceps",
        "secondary": ["Glutes", "Core - Abs"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Banded Glute Bridge",
        "primary": "Glutes",
        "secondary": ["Hamstrings"],
        "equipment": "other",
        "etype": "isolation",
    },
    {
        "name": "Weighted Standing Calf Raise",
        "primary": "Calves",
        "secondary": [],
        "equipment": "machine",
        "etype": "isolation",
    },
    {
        "name": "Kneeling Cable Crunch",
        "primary": "Core - Abs",
        "secondary": [],
        "equipment": "cable",
        "etype": "isolation",
    },
    {
        "name": "Incline Barbell Bench Press",
        "primary": "Chest",
        "secondary": ["Shoulders - Anterior Head", "Triceps"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Cable Crossover",
        "primary": "Chest",
        "secondary": ["Shoulders - Anterior Head"],
        "equipment": "cable",
        "etype": "isolation",
    },
    {
        "name": "Chest Supported Dumbbell Row",
        "primary": "Back - Thickness",
        "secondary": ["Back - Width", "Biceps", "Shoulders - Posterior Head"],
        "equipment": "dumbbell",
        "etype": "compound",
    },
    {
        "name": "Overhead Barbell Press",
        "primary": "Shoulders - Anterior Head",
        "secondary": ["Shoulders - Lateral Head", "Triceps"],
        "equipment": "barbell",
        "etype": "compound",
    },
    {
        "name": "Body-weight Dip",
        "primary": "Triceps",
        "secondary": ["Chest", "Shoulders - Anterior Head"],
        "equipment": "bodyweight",
        "etype": "compound",
    },
    {
        "name": "One-arm Cable Lateral Raise",
        "primary": "Shoulders - Lateral Head",
        "secondary": [],
        "equipment": "cable",
        "etype": "isolation",
    },
    {
        "name": "Dumbbell Biceps Curl",
        "primary": "Biceps",
        "secondary": ["Forearms"],
        "equipment": "dumbbell",
        "etype": "isolation",
    },
]


def main() -> None:
    # Ensure tables exist (the SQL file should be applied before running this seeder)
    # Upsert muscle groups
    for g in MUSCLE_GROUPS:
        execute_query(
            """
            INSERT INTO muscle_groups(name, description)
            VALUES(%s, %s)
            ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description
            """,
            (g["name"], g.get("description")),
            fetch_all=False,
            fetch_one=False,
        )

    # Build name -> id map
    mg_rows = execute_query("SELECT id, name FROM muscle_groups", fetch_all=True) or []
    mg_by_name: Dict[str, int] = {r["name"]: r["id"] for r in mg_rows}

    # Upsert exercises
    for ex in EXERCISES:
        pmg = mg_by_name.get(ex["primary"])
        sec = [mg_by_name.get(n) for n in (ex.get("secondary") or []) if mg_by_name.get(n) is not None]
        execute_query(
            """
            INSERT INTO exercise_definitions(name, primary_muscle_group_id, secondary_muscle_group_ids, equipment_type, exercise_type)
            VALUES(%s,%s,%s,%s,%s)
            ON CONFLICT (name) DO UPDATE SET
              primary_muscle_group_id=EXCLUDED.primary_muscle_group_id,
              secondary_muscle_group_ids=EXCLUDED.secondary_muscle_group_ids,
              equipment_type=EXCLUDED.equipment_type,
              exercise_type=EXCLUDED.exercise_type
            """,
            (ex["name"], pmg, sec, ex["equipment"], ex["etype"]),
            fetch_all=False,
            fetch_one=False,
        )

    print("Seeded strength data: muscle groups and exercises.")


if __name__ == "__main__":
    main()
