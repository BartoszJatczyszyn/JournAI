#!/usr/bin/env python3
"""
CLI entrypoint to start the Enhanced Backend (FastAPI + Uvicorn).

Preferred usage:
  python -m app.cli.start_backend [--port 5002] [--reload] [--workers N]

This forwards to the implementation in app.start_enhanced_backend.
"""
from __future__ import annotations

from app.start_enhanced_backend import main


if __name__ == "__main__":
    main()
