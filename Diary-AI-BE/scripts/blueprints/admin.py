#!/usr/bin/env python3
"""Admin blueprint: operational endpoints (model retraining, cache invalidation).

Currently implements:
POST /api/admin/models/retrain
  - Deletes persisted model artifacts (energy, sleep, mood)
  - Optionally accepts JSON body {"models": [..]} to limit which models
  - Returns JSON with removed files and status

Actual model retraining is lazy: next prediction call will rebuild models.
"""
from __future__ import annotations

from pathlib import Path
from typing import List

from flask import Blueprint, jsonify, request

from analytics.model_utils import model_path

admin_bp = Blueprint("admin", __name__)

DEFAULT_MODELS = ["energy", "sleep", "mood"]


@admin_bp.post("/models/retrain")
def retrain_models():
    try:
        payload = request.get_json(silent=True) or {}
        models: List[str] = payload.get("models") or DEFAULT_MODELS
        removed = []
        for name in models:
            p = model_path(name)
            try:
                if p.exists():
                    p.unlink()
                    removed.append(p.name)
            except Exception as e:  # pragma: no cover - best effort cleanup
                return jsonify({
                    "status": "error",
                    "message": f"Failed removing model {name}: {e}",
                    "removed": removed,
                }), 500
        return jsonify({
            "status": "success",
            "removed": removed,
            "message": "Models deleted; they will be retrained on next prediction request.",
        })
    except Exception as e:  # pragma: no cover
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


__all__ = ["admin_bp"]
