#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def model_path(name: str) -> Path:
    return MODELS_DIR / f"{name}.joblib"


def save_model(name: str, model: Any, scaler: Any | None = None) -> None:
    payload = {"model": model, "scaler": scaler}
    joblib.dump(payload, model_path(name))


def load_model(name: str) -> tuple[Any | None, Any | None]:
    p = model_path(name)
    if not p.exists():
        return None, None
    try:
        payload = joblib.load(p)
        return payload.get("model"), payload.get("scaler")
    except Exception:
        # Invalidate incompatible/corrupted model artifacts and fall back to retraining
        try:
            p.unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass
        return None, None
