#!/usr/bin/env python3
"""Compatibility shim for data_manager.
"""
from cli.data_manager import *  # noqa: F401,F403

try:
    from cli.data_manager import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
