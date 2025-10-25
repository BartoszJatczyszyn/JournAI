from __future__ import annotations

from typing import Any, Dict, List, Optional

from presentation.di import di
from application.services.admin_service import AdminService


def retrain_models(models: Optional[List[str]] = None, svc: AdminService | None = None) -> Dict[str, Any]:
    svc = svc or di.admin_service()
    return svc.retrain_models(models)


__all__ = ["retrain_models"]
