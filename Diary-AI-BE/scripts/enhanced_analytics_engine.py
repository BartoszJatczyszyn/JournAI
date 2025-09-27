#!/usr/bin/env python3
"""Compatibility shim.
This module now lives in scripts/analytics/enhanced_analytics_engine.py.
We re-export public symbols and keep script execution working.
"""
from analytics.enhanced_analytics_engine import *  # noqa: F401,F403

try:
    from analytics.enhanced_analytics_engine import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
