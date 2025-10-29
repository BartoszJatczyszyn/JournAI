from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from presentation.controllers import strength_controller as ctl

router = APIRouter(tags=["strength"], prefix="/strength")


class ExerciseSetIn(BaseModel):
    setNumber: int = Field(ge=1)
    reps: int = Field(ge=0)
    weight: float = Field(ge=0)
    rpe: float | None = Field(default=None, ge=0, le=10)
    isWarmup: bool = False


class ExerciseLogIn(BaseModel):
    exerciseDefinitionId: int
    order: int | None = None
    notes: str | None = None
    sets: list[ExerciseSetIn] = []


class WorkoutSessionIn(BaseModel):
    activityId: int | None = None  # Garmin activity id for strength_training
    startedAt: str | None = None  # ISO timestamp; backend defaults to NOW()
    name: str | None = None
    notes: str | None = None
    durationMinutes: int | None = None
    exercises: list[ExerciseLogIn]


@router.get("/muscle-groups")
def list_muscle_groups():
    return ctl.list_muscle_groups()


@router.get("/exercises")
def search_exercises(query: str | None = Query(default=None), muscleGroupId: int | None = Query(default=None)):
    return ctl.search_exercises(query=query, muscle_group_id=muscleGroupId)


@router.get("/workouts")
def list_workouts(limit: int = 50, offset: int = 0):
    return ctl.list_workouts(limit=limit, offset=offset)


@router.get("/workouts/{workout_id}")
def get_workout(workout_id: int):
    w = ctl.get_workout(workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    return w


@router.post("/workouts")
def create_workout(payload: WorkoutSessionIn):
    return ctl.create_workout(payload.model_dump())

class WorkoutSessionUpdateIn(WorkoutSessionIn):
    pass

@router.put("/workouts/{workout_id}")
def update_workout(workout_id: int, payload: WorkoutSessionUpdateIn):
    updated = ctl.update_workout(workout_id, payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Workout not found")
    return updated


@router.delete("/workouts/{workout_id}")
def delete_workout(workout_id: int):
    ok = ctl.delete_workout(workout_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"status": "ok"}


@router.get("/exercises/{exercise_id}/suggestion")
def suggestion(exercise_id: int):
    return ctl.suggestion_for_next(exercise_definition_id=exercise_id, user_id=None) or {}


@router.get("/exercises/{exercise_id}/stats")
def exercise_stats(exercise_id: int):
    return ctl.exercise_stats(exercise_definition_id=exercise_id, user_id=None)

@router.get("/muscle-groups/{muscle_group_id}/weekly-volume")
def muscle_group_weekly(muscle_group_id: int, weeks: int = 12):
    return ctl.muscle_group_weekly_volume(muscle_group_id=muscle_group_id, weeks=weeks, user_id=None)

@router.get("/muscle-groups/{muscle_group_id}/exercise-contribution")
def exercise_contribution(muscle_group_id: int, days: int = 30):
    return ctl.exercise_contribution_last_month(muscle_group_id=muscle_group_id, days=days, user_id=None)

@router.get("/muscle-groups/{muscle_group_id}/weekly-frequency")
def weekly_frequency(muscle_group_id: int, weeks: int = 12):
    return ctl.weekly_training_frequency(muscle_group_id=muscle_group_id, weeks=weeks, user_id=None)

@router.get("/exercises/{exercise_id}/history")
def exercise_history(exercise_id: int, limit: int = 20):
    return ctl.exercise_history(exercise_definition_id=exercise_id, limit=limit, user_id=None)

# Analytics
@router.get("/analytics/exercises/{exercise_id}/e1rm")
def exercise_e1rm(exercise_id: int):
    return ctl.exercise_e1rm_progress(exercise_definition_id=exercise_id, user_id=None)

@router.get("/analytics/overview")
def workouts_overview(days: int = 90):
    return ctl.workouts_overview(days=days, user_id=None)

@router.get("/analytics/exercises/{exercise_id}/summary")
def exercise_summary(exercise_id: int, days: int = 180):
    return ctl.exercise_summary(exercise_definition_id=exercise_id, days=days, user_id=None)

@router.get("/analytics/top-progress")
def top_progress(days: int = 90, limit: int = 5):
    return ctl.top_progress(days=days, limit=limit, user_id=None)

@router.get("/analytics/correlations")
def correlations(days: int = 90):
    return ctl.strength_correlations(days=days, user_id=None)

# Templates
class StrengthTemplate(BaseModel):
    id: str
    name: str
    createdAt: str
    notes: str | None = None
    exercises: list[ExerciseLogIn]

@router.get('/templates', response_model=list[StrengthTemplate])
def list_templates():
    return ctl.list_templates()

@router.post('/templates', response_model=StrengthTemplate)
def upsert_template(tpl: StrengthTemplate):
    return StrengthTemplate(**ctl.upsert_template(tpl.model_dump()))

@router.delete('/templates/{tpl_id}')
def delete_template(tpl_id: str):
    ok = ctl.delete_template(tpl_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Template not found')
    return {'status': 'ok'}


__all__ = ["router"]
