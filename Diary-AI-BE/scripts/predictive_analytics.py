#!/usr/bin/env python3
"""Compatibility shim for predictive analytics.
"""
from analytics.predictive_analytics import *  # noqa: F401,F403

try:
    from analytics.predictive_analytics import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
