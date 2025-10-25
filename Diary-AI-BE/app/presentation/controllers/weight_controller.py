from __future__ import annotations
from typing import Optional
from application.services.weight_service import WeightService
from presentation.di import di

def current_weight(svc=None) -> dict:
    svc = svc or di.weight_service()
    return svc.get_current()

def weight_history(days: int, svc=None) -> list[dict]:
    svc = svc or di.weight_service()
    return svc.get_history(days)

def weight_stats(svc=None) -> dict:
    svc = svc or di.weight_service()
    return svc.stats()

def weight_correlations(days: int, min_abs: float = 0.0, svc=None) -> dict:
    svc = svc or di.weight_service()
    return svc.correlations(days, min_abs)
