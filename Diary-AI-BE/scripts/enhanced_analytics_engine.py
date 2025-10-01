"""Compatibility shim for legacy imports.

Allows statements like:
    from enhanced_analytics_engine import EnhancedHealthAnalytics, execute_query
which previously failed because the real module lives under analytics.enhanced_analytics_engine
and PYTHONPATH=/app/scripts only exposes `analytics/` package, not a top-level module file.

This file re-exports everything from analytics.enhanced_analytics_engine.
"""
from analytics.enhanced_analytics_engine import *  # type: ignore  # noqa: F401,F403
# Explicit re-export of execute_query so importing code relying on it continues to work.
from analytics.enhanced_analytics_engine import execute_query  # type: ignore  # noqa: F401
