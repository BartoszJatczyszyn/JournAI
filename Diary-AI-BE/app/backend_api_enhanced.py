#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from app.lib.errors import DomainError

from app.blueprints import (
    activities_router,
    admin_router,
    analytics_router,
    core_router,
    gym_router,
    insights_router,
    journal_router,
    llm_router,
    predictions_router,
    sleeps_router,
    trends_router,
)
from presentation.controllers.llm_controller import _build_health_brief
from application.services.llm_reports_service import ensure_table, upsert_report
from application.services.llm_service import LLMService
from app.presentation.routers.weight import router as weight_router

load_dotenv("config.env")

app = FastAPI(
    title="Diary AI Backend",
    version="2.0.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    default_response_class=ORJSONResponse,
)

REQ_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["path", "method", "status"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55),
)
REQ_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["path", "method", "status"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):  # pragma: no cover
    start = time.perf_counter()
    response = await call_next(request)
    dt = time.perf_counter() - start
    path = request.url.path
    method = request.method
    status = str(response.status_code)
    try:
        REQ_LATENCY.labels(path=path, method=method, status=status).observe(dt)
        REQ_COUNT.labels(path=path, method=method, status=status).inc()
    except Exception:
        pass
    return response


@app.get("/metrics")
async def metrics():  # pragma: no cover
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


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

@app.exception_handler(DomainError)
async def domain_exception_handler(request: Request, exc: DomainError):  # pragma: no cover
    return JSONResponse(
        status_code=getattr(exc, "status_code", 400),
        content={
            "status": "error",
            "error": {"code": getattr(exc, "code", "domain_error"), "message": exc.message},
            "code": getattr(exc, "status_code", 400),
        },
    )


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(predictions_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(activities_router, prefix="/api")
app.include_router(sleeps_router, prefix="/api")
app.include_router(trends_router, prefix="/api")
app.include_router(journal_router, prefix="/api")
app.include_router(gym_router, prefix="/api")
app.include_router(llm_router, prefix="/api")
app.include_router(weight_router, prefix="/api")


@app.get("/api/health", tags=["system"], summary="Service health check")
def health_check():  # pragma: no cover
    return {"status": "ok"}


@app.get("/api/analytics/info", tags=["system"], summary="Capabilities overview")
def analytics_info():  # pragma: no cover
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


logger = logging.getLogger("llm_scheduler")


async def _scheduler_loop():  # pragma: no cover
    try:
        enabled = os.getenv("ENABLE_LLM_REPORT_SCHEDULER", "1").lower() in {"1", "true", "yes", "on"}
        if not enabled:
            logger.info("LLM report scheduler disabled via env")
            return
        ensure_table()
        llm_days = int(os.getenv("LLM_REPORT_DAYS", "30"))
        language = os.getenv("LLM_REPORT_LANGUAGE", "pl")
        hour = int(os.getenv("LLM_SCHEDULE_HOUR", "8"))
        minute = int(os.getenv("LLM_SCHEDULE_MINUTE", "15"))
        client = LLMService()
        while True:
            now = datetime.now()
            run_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if run_at <= now:
                run_at = run_at + timedelta(days=1)
            wait_sec = (run_at - now).total_seconds()
            await asyncio.sleep(wait_sec)
            try:
                brief = _build_health_brief(llm_days)
                messages = [
                    {"role": "system", "content": f"You are a health assistant. Prepare a concise report ({llm_days} days)."},
                    {"role": "user", "content": f"Data for the report (JSON/text):\n{brief}"},
                ]
                res = await client.chat(messages, temperature=0.2, max_tokens=700, top_p=0.9)
                content = res.get("content", "")
                upsert_report(date.today().isoformat(), language, llm_days, content, res.get("raw"))
                logger.info("Daily LLM health report stored")
            except Exception as e:
                logger.exception("Failed to generate/store daily LLM report: %s", e)
            await asyncio.sleep(60)
    except Exception as outer:
        logger.exception("LLM scheduler crashed: %s", outer)


@app.on_event("startup")
async def _on_startup():  # pragma: no cover
    # Warn if GarminDb config not present
    cfg = Path.home() / ".GarminDb" / "GarminConnectConfig.json"
    if not cfg.exists():
        logging.getLogger("startup").warning(
            "GarminDb configuration not found at %s. Run ./setup_garmindb.sh (outside container) or configure credentials.",
            str(cfg),
        )
    asyncio.create_task(_scheduler_loop())


__all__ = ["app"]
