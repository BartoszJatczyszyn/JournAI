#!/usr/bin/env python3
"""Compatibility shim for specialized analytics.
"""
from analytics.specialized_analytics import *  # noqa: F401,F403

try:
    from analytics.specialized_analytics import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
