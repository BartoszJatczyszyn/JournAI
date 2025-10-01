#!/usr/bin/env python3
"""FastAPI application bootstrap (migrated from Flask).

Responsibilities:
  * Load environment variables (config.env)
  * Create FastAPI instance with CORS middleware
  * Include modular routers (analytics, predictions, insights, activities, sleeps, trends, admin, core)
  * Expose `app` for uvicorn / programmatic startup

Route compatibility:
  Original Flask blueprint prefixes are preserved so existing frontend paths (/api/...) keep working.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load env early
load_dotenv("config.env")

app = FastAPI(title="Diary AI Backend", version="2.0.0", openapi_url="/api/openapi.json", docs_url="/api/docs")
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # pragma: no cover
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {"code": "internal_error", "message": str(exc) or "Internal Server Error"},
            "code": 500,
        },
    )

from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):  # pragma: no cover
    code_map = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "validation_error"}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {"code": code_map.get(exc.status_code, "error"), "message": exc.detail},
            "code": exc.status_code,
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):  # pragma: no cover
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {"code": "validation_error", "message": "Validation failed", "details": exc.errors()},
            "code": 422,
        },
    )

# CORS (broad during migration; tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers (converted from Flask blueprints)
from blueprints import (
    analytics_router,
    predictions_router,
    activities_router,
    sleeps_router,
    core_router,
    admin_router,
    insights_router,
    trends_router,
    journal_router,
)

# Include routers preserving original external paths
app.include_router(core_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(predictions_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(activities_router, prefix="/api")
app.include_router(sleeps_router, prefix="/api")
app.include_router(trends_router, prefix="/api")
app.include_router(journal_router, prefix="/api")


@app.get("/api/health", tags=["system"], summary="Service health check")
def health_check():  # pragma: no cover - trivial
    return {"status": "ok"}


@app.get("/api/analytics/info", tags=["system"], summary="Capabilities overview")
def analytics_info():  # pragma: no cover - static
    return {
        "service": "Diary AI Backend",
        "capabilities": [
            "Advanced correlations",
            "Clustering",
            "Temporal patterns",
            "Recovery analysis",
            "Specialized sleep/stress/activity",
            "Predictive analytics",
            "Personalized insights",
            "Period comparisons",
            "Health trends",
        ],
        "version": "2.0.0",
    }


__all__ = ["app"]

