"""Compatibility shim exposing analytics.model_utils at top-level.
Required because various modules use `from model_utils import ...`.
This forwards to the canonical implementation in `analytics.model_utils`.
"""
from analytics.model_utils import *  # type: ignore  # noqa: F401,F403
