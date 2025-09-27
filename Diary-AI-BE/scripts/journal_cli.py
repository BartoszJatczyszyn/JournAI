#!/usr/bin/env python3
"""Compatibility shim for journal_cli.
"""
from cli.journal_cli import *  # noqa: F401,F403

try:
    from cli.journal_cli import main as _main
except Exception:  # pragma: no cover
    _main = None

if __name__ == "__main__" and _main:
    _main()
