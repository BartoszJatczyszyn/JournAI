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
    userId: str
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
def list_workouts(limit: int = 50, offset: int = 0, userId: str | None = None):
    return ctl.list_workouts(limit=limit, offset=offset, user_id=userId)


@router.get("/workouts/{workout_id}")
def get_workout(workout_id: int):
    w = ctl.get_workout(workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    return w


@router.post("/workouts")
def create_workout(payload: WorkoutSessionIn):
    return ctl.create_workout(payload.model_dump())


@router.delete("/workouts/{workout_id}")
def delete_workout(workout_id: int):
    ok = ctl.delete_workout(workout_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"status": "ok"}


@router.get("/exercises/{exercise_id}/suggestion")
def suggestion(exercise_id: int, userId: str):
    return ctl.suggestion_for_next(exercise_definition_id=exercise_id, user_id=userId) or {}


@router.get("/exercises/{exercise_id}/stats")
def exercise_stats(exercise_id: int, userId: str | None = None):
    return ctl.exercise_stats(exercise_definition_id=exercise_id, user_id=userId)

@router.get("/muscle-groups/{muscle_group_id}/weekly-volume")
def muscle_group_weekly(muscle_group_id: int, weeks: int = 12, userId: str | None = None):
    return ctl.muscle_group_weekly_volume(muscle_group_id=muscle_group_id, weeks=weeks, user_id=userId)

@router.get("/muscle-groups/{muscle_group_id}/exercise-contribution")
def exercise_contribution(muscle_group_id: int, days: int = 30, userId: str | None = None):
    return ctl.exercise_contribution_last_month(muscle_group_id=muscle_group_id, days=days, user_id=userId)

@router.get("/muscle-groups/{muscle_group_id}/weekly-frequency")
def weekly_frequency(muscle_group_id: int, weeks: int = 12, userId: str | None = None):
    return ctl.weekly_training_frequency(muscle_group_id=muscle_group_id, weeks=weeks, user_id=userId)

@router.get("/exercises/{exercise_id}/history")
def exercise_history(exercise_id: int, limit: int = 20, userId: str | None = None):
    return ctl.exercise_history(exercise_definition_id=exercise_id, limit=limit, user_id=userId)

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
