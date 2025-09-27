#!/usr/bin/env python3
"""Compatibility shim for refresh_features_view.
"""
from migrations.refresh_features_view import *  # noqa: F401,F403

try:
    from migrations.refresh_features_view import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
