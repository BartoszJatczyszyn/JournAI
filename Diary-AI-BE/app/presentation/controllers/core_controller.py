from __future__ import annotations

from typing import Any, Dict, List

from presentation.di import di
from application.services.core_service import CoreService


def stats(svc: CoreService | None = None) -> Dict[str, Any]:
    svc = svc or di.core_service()
    return svc.get_stats()


def health_data(days: int, svc: CoreService | None = None) -> List[Dict[str, Any]]:
    svc = svc or di.core_service()
    return svc.get_health_data(days)


def heart_rate_raw(day: str, svc: CoreService | None = None) -> List[Dict[str, Any]]:
    svc = svc or di.core_service()
    return svc.get_raw_series("garmin_heart_rate_data", day, "bpm")


def stress_raw(day: str, svc: CoreService | None = None) -> List[Dict[str, Any]]:
    svc = svc or di.core_service()
    return svc.get_raw_series("garmin_stress_data", day, "stress")


def respiratory_rate_raw(day: str, svc: CoreService | None = None) -> List[Dict[str, Any]]:
    svc = svc or di.core_service()
    return svc.get_raw_series("garmin_respiratory_rate_data", day, "rr")


__all__ = [
    "stats",
    "health_data",
    "heart_rate_raw",
    "stress_raw",
    "respiratory_rate_raw",
]
