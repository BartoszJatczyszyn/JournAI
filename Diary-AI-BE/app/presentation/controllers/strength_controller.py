from __future__ import annotations
from typing import Optional

from presentation.di import di


def list_muscle_groups(svc=None) -> list:
    svc = svc or di.strength_service()
    return svc.list_muscle_groups()


def search_exercises(query: str | None = None, muscle_group_id: int | None = None, svc=None) -> list:
    svc = svc or di.strength_service()
    return svc.search_exercises(query=query, muscle_group_id=muscle_group_id)


def list_exercises(svc=None) -> list:
    svc = svc or di.strength_service()
    return svc.list_exercises()


def create_workout(payload: dict, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.save_workout(payload)


def get_workout(workout_id: int, svc=None) -> dict | None:
    svc = svc or di.strength_service()
    return svc.get_workout(workout_id)


def list_workouts(limit: int = 50, offset: int = 0, user_id: str | None = None, svc=None) -> list:
    svc = svc or di.strength_service()
    return svc.list_workouts(limit=limit, offset=offset, user_id=user_id)


def delete_workout(workout_id: int, svc=None) -> bool:
    svc = svc or di.strength_service()
    return svc.delete_workout(workout_id)


def suggestion_for_next(exercise_definition_id: int, user_id: str, svc=None) -> dict | None:
    svc = svc or di.strength_service()
    return svc.suggestion_for_next(exercise_definition_id=exercise_definition_id, user_id=user_id)


def exercise_stats(exercise_definition_id: int, user_id: str | None = None, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.exercise_stats(exercise_definition_id, user_id)


def muscle_group_weekly_volume(muscle_group_id: int, weeks: int = 12, user_id: str | None = None, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.muscle_group_weekly_volume(muscle_group_id, weeks, user_id)


def exercise_contribution_last_month(muscle_group_id: int, days: int = 30, user_id: str | None = None, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.exercise_contribution_last_month(muscle_group_id, days, user_id)


def weekly_training_frequency(muscle_group_id: int, weeks: int = 12, user_id: str | None = None, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.weekly_training_frequency(muscle_group_id, weeks, user_id)


def exercise_history(exercise_definition_id: int, limit: int = 20, user_id: str | None = None, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.exercise_history(exercise_definition_id, limit, user_id)


def list_templates(svc=None) -> list:
    svc = svc or di.strength_service()
    return svc.list_templates()


def upsert_template(tpl: dict, svc=None) -> dict:
    svc = svc or di.strength_service()
    return svc.upsert_template(tpl)


def delete_template(tpl_id: str, svc=None) -> bool:
    svc = svc or di.strength_service()
    return svc.delete_template(tpl_id)

__all__ = [
    "list_muscle_groups",
    "search_exercises",
    "list_exercises",
    "create_workout",
    "get_workout",
    "list_workouts",
    "delete_workout",
    "suggestion_for_next",
    "exercise_stats",
    "muscle_group_weekly_volume",
    "exercise_contribution_last_month",
    "weekly_training_frequency",
    "exercise_history",
    "list_templates",
    "upsert_template",
    "delete_template",
]
