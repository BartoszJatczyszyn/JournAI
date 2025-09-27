#!/usr/bin/env python3
"""Compatibility shim for enhanced migration module.
"""
from migrations.enhanced_migration import *  # noqa: F401,F403

try:
    from migrations.enhanced_migration import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
