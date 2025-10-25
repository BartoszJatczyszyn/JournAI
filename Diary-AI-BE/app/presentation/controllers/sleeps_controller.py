from __future__ import annotations
from typing import Any, Dict, Optional
from application.services.sleeps_service import SleepsService
from presentation.di import di

async def latest(limit: int, offset: int, start_date: Optional[str], end_date: Optional[str], svc=None) -> Dict[str, Any]:
    svc = svc or di.sleeps_service()
    return await svc.latest(limit, offset, start_date, end_date)

async def detail(sleep_id: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.sleeps_service()
    return await svc.detail(sleep_id)

async def create_sleep(payload: Dict[str, Any], svc=None) -> Dict[str, Any]:
    svc = svc or di.sleeps_service()
    return await svc.create_sleep(payload)

async def update_sleep(sleep_id: int, payload: Dict[str, Any], svc=None) -> Dict[str, Any]:
    svc = svc or di.sleeps_service()
    return await svc.update_sleep(sleep_id, payload)

async def delete_sleep(sleep_id: int, svc=None) -> bool:
    svc = svc or di.sleeps_service()
    return await svc.delete_sleep(sleep_id)
