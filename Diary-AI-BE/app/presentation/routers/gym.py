from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from application.services.gym_service import GymService
from presentation.controllers import gym_controller as ctl
from datetime import datetime

router = APIRouter(tags=["gym"], prefix="/gym")

class ExerciseTemplateModel(BaseModel):
    id: str
    name: str
    unilateral: bool = False
    defaultSets: int = Field(ge=1, default=3)
    defaultReps: int = Field(ge=1, default=10)
    defaultWeight: float = 0.0

class ProgressionConfig(BaseModel):
    # Pydantic v2: 'regex' replaced by 'pattern'
    type: str = Field(pattern="^(linear|double|auto)$", default="linear")
    incrementKg: float = 2.5
    repRangeMin: int = 6
    repRangeMax: int = 10
    targetRPE: float = 8.0

class TemplateModel(BaseModel):
    id: str
    name: str
    createdAt: datetime
    progression: ProgressionConfig
    exercises: List[ExerciseTemplateModel]

class SetModel(BaseModel):
    id: str
    weight: Optional[float]
    reps: Optional[int]
    rpe: Optional[float] = None
    tempo: Optional[str] = None
    drop: Optional[bool] = False

class ExerciseSessionModel(BaseModel):
    exerciseId: str
    sets: List[SetModel]

class SessionModel(BaseModel):
    id: str
    date: datetime
    templateId: str
    notes: Optional[str] = ''
    exercises: List[ExerciseSessionModel]

from application.services.gym_service import GymService  # kept import for typing/forward ref; instance not needed

@router.get('/templates', response_model=list[TemplateModel])
def list_templates():
    return ctl.list_templates()

@router.post('/templates', response_model=TemplateModel)
def upsert_template(tpl: TemplateModel):
    return TemplateModel(**ctl.upsert_template(tpl.model_dump()))

@router.delete('/templates/{tpl_id}')
def delete_template(tpl_id: str):
    ok = ctl.delete_template(tpl_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Template not found')
    return {'status': 'ok'}

@router.get('/sessions', response_model=list[SessionModel])
def list_sessions():
    return ctl.list_sessions()

@router.post('/sessions', response_model=SessionModel)
def upsert_session(session: SessionModel):
    return SessionModel(**ctl.upsert_session(session.model_dump()))

@router.delete('/sessions/{session_id}')
def delete_session(session_id: str):
    ok = ctl.delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Session not found')
    return {'status': 'ok'}

class Manual1RMEntry(BaseModel):
    id: str
    exerciseId: str
    value: float
    date: datetime

@router.get('/manual-1rm', response_model=list[Manual1RMEntry])
def list_manual_1rm():
    return ctl.list_manual_1rm()

@router.post('/manual-1rm', response_model=Manual1RMEntry)
def upsert_manual_1rm(entry: Manual1RMEntry):
    return Manual1RMEntry(**ctl.upsert_manual_1rm(entry.model_dump()))

@router.delete('/manual-1rm/{entry_id}')
def delete_manual_1rm(entry_id: str):
    ok = ctl.delete_manual_1rm(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Entry not found')
    return {'status': 'ok'}

__all__ = ['router']