from __future__ import annotations
from application.services.gym_service import GymService
from presentation.di import di

def list_templates(svc=None) -> list:
    svc = svc or di.gym_service()
    return svc.list_templates()

def upsert_template(tpl: dict, svc=None) -> dict:
    svc = svc or di.gym_service()
    return svc.upsert_template(tpl)

def delete_template(tpl_id: str, svc=None) -> bool:
    svc = svc or di.gym_service()
    return svc.delete_template(tpl_id)

def list_sessions(svc=None) -> list:
    svc = svc or di.gym_service()
    return svc.list_sessions()

def upsert_session(session: dict, svc=None) -> dict:
    svc = svc or di.gym_service()
    return svc.upsert_session(session)

def delete_session(session_id: str, svc=None) -> bool:
    svc = svc or di.gym_service()
    return svc.delete_session(session_id)

def list_manual_1rm(svc=None) -> list:
    svc = svc or di.gym_service()
    return svc.list_manual_1rm()

def upsert_manual_1rm(entry: dict, svc=None) -> dict:
    svc = svc or di.gym_service()
    return svc.upsert_manual_1rm(entry)

def delete_manual_1rm(entry_id: str, svc=None) -> bool:
    svc = svc or di.gym_service()
    return svc.delete_manual_1rm(entry_id)
