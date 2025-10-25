from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Dict, Any

from model_utils import model_path


DEFAULT_MODELS = ["energy", "sleep", "mood"]


@dataclass
class AdminService:
    """Administrative operations not tied to a single domain.

    Currently supports removing cached prediction models so they retrain on next use.
    """

    def retrain_models(self, models: Optional[List[str]] = None) -> Dict[str, Any]:
        target_models = models or DEFAULT_MODELS
        removed: List[str] = []
        for name in target_models:
            p = model_path(name)
            try:
                if p.exists():
                    p.unlink()
                    removed.append(p.name)
            except Exception as e:  # pragma: no cover
                # Propagate as a structured error; HTTP layer decides status code
                return {
                    "status": "error",
                    "message": f"Failed removing model {name}: {e}",
                    "removed": removed,
                }

        return {
            "status": "success",
            "removed": removed,
            "message": "Models deleted; they will be retrained on next prediction request.",
        }


__all__ = ["AdminService", "DEFAULT_MODELS"]
