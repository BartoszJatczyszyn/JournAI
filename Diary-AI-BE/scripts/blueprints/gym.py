from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from db import execute_query
from datetime import datetime

router = APIRouter(tags=["gym"], prefix="/gym")

# Pydantic models
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

# Simple storage tables (if not exist) - expect a generic json store table
# For a production setup you'd have normalized tables. Here we lean on a JSON table for quick integration.

INIT_SQL = """
CREATE TABLE IF NOT EXISTS gym_store (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""

def ensure_table():  # idempotent
    try:
        execute_query(INIT_SQL)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Init error: {e}")

def load_bucket(bucket: str) -> list:
    ensure_table()
    row = execute_query("SELECT payload FROM gym_store WHERE key=%s", (bucket,), fetch_one=True)
    return row['payload'] if row and row['payload'] else []

def save_bucket(bucket: str, data: list):
    ensure_table()
    execute_query("""
      INSERT INTO gym_store(key,payload,updated_at) VALUES(%s,%s,NOW())
      ON CONFLICT (key) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()
    """, (bucket, data))

TEMPLATES_KEY = 'templates'
SESSIONS_KEY = 'sessions'
MANUAL1RM_KEY = 'manual_1rm'

@router.get('/templates', response_model=list[TemplateModel])
def list_templates():
    return load_bucket(TEMPLATES_KEY)

@router.post('/templates', response_model=TemplateModel)
def upsert_template(tpl: TemplateModel):
    data = load_bucket(TEMPLATES_KEY)
    # replace or append
    data = [d for d in data if d.get('id') != tpl.id]
    data.append(tpl.model_dump())
    save_bucket(TEMPLATES_KEY, data)
    return tpl

@router.delete('/templates/{tpl_id}')
def delete_template(tpl_id: str):
    data = load_bucket(TEMPLATES_KEY)
    new_data = [d for d in data if d.get('id') != tpl_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail='Template not found')
    save_bucket(TEMPLATES_KEY, new_data)
    return { 'status': 'ok' }

@router.get('/sessions', response_model=list[SessionModel])
def list_sessions():
    return load_bucket(SESSIONS_KEY)

@router.post('/sessions', response_model=SessionModel)
def upsert_session(session: SessionModel):
    data = load_bucket(SESSIONS_KEY)
    data = [d for d in data if d.get('id') != session.id]
    data.append(session.model_dump())
    save_bucket(SESSIONS_KEY, data)
    return session

@router.delete('/sessions/{session_id}')
def delete_session(session_id: str):
    data = load_bucket(SESSIONS_KEY)
    new_data = [d for d in data if d.get('id') != session_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail='Session not found')
    save_bucket(SESSIONS_KEY, new_data)
    return { 'status': 'ok' }

class Manual1RMEntry(BaseModel):
    id: str
    exerciseId: str
    value: float
    date: datetime

@router.get('/manual-1rm', response_model=list[Manual1RMEntry])
def list_manual_1rm():
    return load_bucket(MANUAL1RM_KEY)

@router.post('/manual-1rm', response_model=Manual1RMEntry)
def upsert_manual_1rm(entry: Manual1RMEntry):
    data = load_bucket(MANUAL1RM_KEY)
    data = [d for d in data if d.get('id') != entry.id]
    data.append(entry.model_dump())
    save_bucket(MANUAL1RM_KEY, data)
    return entry

@router.delete('/manual-1rm/{entry_id}')
def delete_manual_1rm(entry_id: str):
    data = load_bucket(MANUAL1RM_KEY)
    new_data = [d for d in data if d.get('id') != entry_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail='Entry not found')
    save_bucket(MANUAL1RM_KEY, new_data)
    return { 'status': 'ok' }

__all__ = ['router']