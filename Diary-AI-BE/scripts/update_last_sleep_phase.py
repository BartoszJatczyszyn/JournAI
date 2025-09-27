#!/usr/bin/env python3
"""Compatibility shim for update_last_sleep_phase.
"""
from migrations.update_last_sleep_phase import *  # noqa: F401,F403

try:
    from migrations.update_last_sleep_phase import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
