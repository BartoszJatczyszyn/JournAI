"""Deprecated: moved to presentation.http.

This shim preserves backward compatibility for existing imports
(`from app.http_helpers import http_error, parse_*`). New code should
import from `presentation.http` directly.
"""
from __future__ import annotations

from presentation.http import (
    http_error,
    parse_int_arg,
    parse_bool_arg,
    parse_date_arg,
)

__all__ = ["http_error", "parse_int_arg", "parse_bool_arg", "parse_date_arg"]
