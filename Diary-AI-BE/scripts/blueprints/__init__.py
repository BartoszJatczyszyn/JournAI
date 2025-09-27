#!/usr/bin/env python3
"""Blueprint package for the Enhanced Backend API.

This package exposes individual Flask blueprints and a helper to register them.
"""
from __future__ import annotations

from flask import Flask

# Import blueprints
from .analytics import analytics_bp
from .predictions import predictions_bp
from .admin import admin_bp
from .insights import insights_bp
from .activities import activities_bp
from .sleeps import sleeps_bp
from .core import core_bp
from .trends import trends_bp

__all__ = [
    "register_blueprints",
    "analytics_bp",
    "predictions_bp",
    "insights_bp",
    "activities_bp",
    "sleeps_bp",
]


def register_blueprints(app: Flask) -> None:
    """Register all blueprints on the provided app.

    We keep url_prefix at "/api" for most blueprints to preserve existing
    public paths exactly as before.
    """
    # Note: We keep url_prefix="/api" and define full subpaths inside each blueprint
    # to avoid changing any externally visible routes.
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(core_bp, url_prefix="/api")
    app.register_blueprint(predictions_bp, url_prefix="/api/predictions")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(insights_bp, url_prefix="/api/insights")
    app.register_blueprint(activities_bp, url_prefix="/api/activities")
    app.register_blueprint(sleeps_bp, url_prefix="/api")
    app.register_blueprint(trends_bp, url_prefix="/api/trends")
