#!/usr/bin/env python3
from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Query
from presentation.http import http_error
from app.db import async_execute_query
from infrastructure.analytics import (
    ActivityAnalytics,
)
from schemas.analytics import AnalysisResponse
from presentation.controllers import analytics_controller as ctl

router = APIRouter(tags=["analytics"], prefix="")

_activity = ActivityAnalytics()

@router.get("/analytics/enhanced/comprehensive", response_model=AnalysisResponse)
async def enhanced_comprehensive(days: int = Query(90, ge=1, le=365)):
    try:
        return await ctl.enhanced_comprehensive(days)
    except ValueError as ve:  # pragma: no cover
        return http_error(str(ve), 400)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/correlations", response_model=AnalysisResponse)
async def enhanced_correlations(days: int = Query(90, ge=1, le=365)):
    try:
        return await ctl.enhanced_correlations(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/clusters", response_model=AnalysisResponse)
async def enhanced_clusters(
    days: int = Query(90, ge=1, le=365),
    clusters: int = Query(3, ge=2, le=15, alias="clusters"),
):
    try:
        return await ctl.enhanced_clusters(days, clusters)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/temporal-patterns", response_model=AnalysisResponse)
async def enhanced_temporal_patterns(days: int = Query(90, ge=1, le=365)):
    try:
        return await ctl.enhanced_temporal_patterns(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/recovery", response_model=AnalysisResponse)
async def enhanced_recovery(
    compare: bool = Query(False),
    start_date: str | None = None,
    end_date: str | None = None,
    days: int = Query(90, ge=1, le=365),
):
    try:
        return await ctl.enhanced_recovery(compare=compare, start_date=start_date, end_date=end_date, days=days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/sleep/comprehensive")
async def sleep_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        return await ctl.sleep_comprehensive(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/stress/comprehensive")
async def stress_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        return await ctl.stress_comprehensive(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/activity/comprehensive")
async def activity_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        return await ctl.activity_comprehensive(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)


@router.get("/analytics/running")
async def running_comprehensive(
    days: int = Query(90, ge=1, le=365),
    start_date: str | None = Query(None, description="Optional explicit start date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="Optional explicit end date (YYYY-MM-DD)"),
):
    """Comprehensive running analytics with optional explicit date range.

    If both start_date and end_date are provided (and valid), the range takes priority over the rolling 'days' window.
    Returned data will have ascending runs list so the newest dates render at the right end of an X axis naturally.
    """
    try:
        analysis = _activity.analyze_running(days, start_date=start_date, end_date=end_date)
        # Run a raw diagnostic SQL (mirrors the analyzer's COALESCE filter) to compare results
        raw_sample = None
        try:
            if start_date and end_date:
                q = f"""
                SELECT activity_id, sport, start_time, day, distance, avg_pace
                FROM garmin_activities
                WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                  AND (COALESCE(day, start_time::date) BETWEEN '{start_date}' AND '{end_date}')
                ORDER BY start_time DESC LIMIT 20
                """
            else:
                q = f"""
                SELECT activity_id, sport, start_time, day, distance, avg_pace
                FROM garmin_activities
                WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
                  AND (COALESCE(day, start_time::date) >= (CURRENT_DATE - INTERVAL '{days} days'))
                ORDER BY start_time DESC LIMIT 20
                """
            raw_rows = await async_execute_query(q) or []
            for r in raw_rows:
                if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                    r['start_time'] = r['start_time'].isoformat()
                if r.get('day') and hasattr(r['day'], 'isoformat'):
                    r['day'] = r['day'].isoformat()
            raw_sample = raw_rows
        except Exception:
            raw_sample = None

        return {
            "status": "success",
            "analysis_type": "running_comprehensive",
            "period_days": days,
            "running_analysis": analysis,
            "raw_query_sample": raw_sample,
            "timestamp": datetime.now().isoformat(),
        }
    except ValueError as ve:  # pragma: no cover
        return http_error(str(ve), 400)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/correlations")
async def correlations_legacy():
    try:
        return await ctl.correlations_legacy()
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)


@router.get("/analytics/debug/running_samples")
async def debug_running_samples(days: int = Query(90, ge=1, le=365)):
    """Debug endpoint: return counts and common sport labels to diagnose missing running rows."""
    try:
        return await ctl.debug_running_counts(days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)


@router.get('/analytics/debug/raw_running_range')
async def debug_raw_running_range(start_date: str = Query(..., description='YYYY-MM-DD'), end_date: str = Query(..., description='YYYY-MM-DD')):
    """Run the COALESCE range query with literal date strings inserted (no param binding) to compare results."""
    try:
        return await ctl.debug_raw_running_range(start_date, end_date)
    except Exception as e:
        return http_error(str(e), 500)

@router.get("/analytics/compare/periods")
async def compare_periods(
    period1_days: int = Query(30, ge=1, le=365),
    period2_days: int = Query(30, ge=1, le=365),
    offset_days: int = Query(30, ge=0, le=365),
):
    try:
        return await ctl.compare_periods(period1_days, period2_days, offset_days)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

__all__ = ["router"]


@router.get("/analytics/debug/activity_source")
def debug_activity_source():
    """Return module/file for the ActivityAnalytics instance and basic sanity info."""
    try:
        return ctl.debug_activity_source()
    except Exception as e:
        return {'error': str(e)}

