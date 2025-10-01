#!/usr/bin/env python3
"""HTTP helper utilities (FastAPI unified).

Replaces legacy Flask-specific helper. Provides:
  - http_error() unified error envelope
  - parse_* helpers raising HTTPException on invalid input
"""
from __future__ import annotations

from datetime import date
from fastapi import HTTPException
from typing import Optional, Any, Dict

_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}
_FALSE_VALUES = {"0", "false", "f", "no", "n", "off"}

_CODE_MAP = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    500: "internal_error",
}

def http_error(message: str, status_code: int = 400, code: str | None = None) -> Dict[str, Any]:
    return {
        "status": "error",
        "error": {
            "code": code or _CODE_MAP.get(status_code, "error"),
            "message": message,
        },
        "code": status_code,
    }

def parse_int_arg(value: str | None, name: str, default: Optional[int], min_value: Optional[int] = None, max_value: Optional[int] = None) -> int:
    if value is None or value == "":
        if default is None:
            raise HTTPException(status_code=400, detail=f"Missing required parameter: {name}")
        iv = int(default)
    else:
        try:
            iv = int(value)
        except Exception:  # pragma: no cover
            raise HTTPException(status_code=400, detail=f"Parameter '{name}' must be an integer")
    if min_value is not None and iv < min_value:
        raise HTTPException(status_code=400, detail=f"Parameter '{name}' must be >= {min_value}")
    if max_value is not None and iv > max_value:
        raise HTTPException(status_code=400, detail=f"Parameter '{name}' must be <= {max_value}")
    return iv

def parse_bool_arg(value: str | None, default: bool = False) -> bool:
    if value is None:
        return bool(default)
    s = str(value).strip().lower()
    if s in _TRUE_VALUES:
        return True
    if s in _FALSE_VALUES:
        return False
    return bool(default)

def parse_date_arg(value: str | None, name: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except Exception:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"Parameter '{name}' must be in YYYY-MM-DD format")

__all__ = [
    "http_error",
    "parse_int_arg",
    "parse_bool_arg",
    "parse_date_arg",
]
