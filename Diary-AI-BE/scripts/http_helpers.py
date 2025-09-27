#!/usr/bin/env python3
"""HTTP helpers for parameter parsing and responses.

These helpers provide small, dependency-free utilities to keep route handlers
clean and consistent across blueprints.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from flask import jsonify, request


_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}
_FALSE_VALUES = {"0", "false", "f", "no", "n", "off"}


def error_response(message: str, status_code: int = 400):
    """Return a standardized JSON error response."""
    return jsonify({"status": "error", "message": message}), status_code


def parse_int_arg(name: str, default: Optional[int], min_value: Optional[int] = None, max_value: Optional[int] = None) -> int:
    """Parse an integer query parameter with validation.

    - If parameter missing and default is not None: returns default
    - If invalid or out-of-range: raises ValueError with a descriptive message
    """
    raw = request.args.get(name, None)
    if raw is None or raw == "":
        if default is None:
            raise ValueError(f"Missing required parameter: {name}")
        value = int(default)
    else:
        try:
            value = int(raw)
        except Exception:
            raise ValueError(f"Parameter '{name}' must be an integer")

    if min_value is not None and value < min_value:
        raise ValueError(f"Parameter '{name}' must be >= {min_value}")
    if max_value is not None and value > max_value:
        raise ValueError(f"Parameter '{name}' must be <= {max_value}")
    return value


def parse_bool_arg(name: str, default: bool = False) -> bool:
    raw = request.args.get(name, None)
    if raw is None:
        return bool(default)
    s = str(raw).strip().lower()
    if s in _TRUE_VALUES:
        return True
    if s in _FALSE_VALUES:
        return False
    # Non-empty, non-recognized: default to False unless default True
    return bool(default)


def parse_date_arg(name: str) -> Optional[date]:
    """Parse a YYYY-MM-DD date argument; returns None if missing.
    Raises ValueError on invalid format.
    """
    raw = request.args.get(name, None)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except Exception:
        raise ValueError(f"Parameter '{name}' must be in YYYY-MM-DD format")
