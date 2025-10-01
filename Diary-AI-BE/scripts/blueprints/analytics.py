#!/usr/bin/env python3
"""Analytics router (FastAPI). Clean version after Flask removal."""
from __future__ import annotations
from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from http_helpers import http_error
from db import execute_query
from enhanced_analytics_engine import EnhancedHealthAnalytics
from specialized_analytics import (
    ActivityAnalytics,
    SleepAnalytics,
    StressAnalytics,
    RecoveryPatternAnalytics,
)

router = APIRouter(tags=["analytics"], prefix="")
_enhanced = EnhancedHealthAnalytics()
_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()
_recovery_patterns = RecoveryPatternAnalytics()

@router.get("/analytics/enhanced/comprehensive")
def enhanced_comprehensive(days: int = Query(90, ge=1, le=365)):
    try:
        insights = _enhanced.get_comprehensive_insights(days)
        return {
            "status": "success",
            "analysis_type": "enhanced_comprehensive",
            "period_days": days,
            "insights": insights,
            "timestamp": datetime.now().isoformat(),
        }
    except ValueError as ve:  # pragma: no cover
        return http_error(str(ve), 400)
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/correlations")
def enhanced_correlations(days: int = Query(90, ge=1, le=365)):
    try:
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return http_error("No data available for correlation analysis", 404)
        correlations = _enhanced.calculate_advanced_correlations(data)
        return {
            "status": "success",
            "analysis_type": "enhanced_correlations",
            "period_days": days,
            "data_points": len(data),
            "correlations": correlations,
            "data_fetch_meta": _enhanced.last_fetch_meta,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/clusters")
def enhanced_clusters(
    days: int = Query(90, ge=1, le=365),
    clusters: int = Query(3, ge=2, le=15, alias="clusters"),
):
    try:
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return http_error("No data available for cluster analysis", 404)
        cluster_data = _enhanced.perform_cluster_analysis(data, clusters)
        return {
            "status": "success",
            "analysis_type": "cluster_analysis",
            "period_days": days,
            "clusters": cluster_data,
            "data_fetch_meta": _enhanced.last_fetch_meta,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/temporal-patterns")
def enhanced_temporal_patterns(days: int = Query(90, ge=1, le=365)):
    try:
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return http_error("No data available for temporal analysis", 404)
        patterns = _enhanced.analyze_temporal_patterns(data)
        return {
            "status": "success",
            "analysis_type": "temporal_patterns",
            "period_days": days,
            "patterns": patterns,
            "data_fetch_meta": _enhanced.last_fetch_meta,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/enhanced/recovery")
def enhanced_recovery(
    compare: bool = Query(False),
    start_date: str | None = None,
    end_date: str | None = None,
    days: int = Query(90, ge=1, le=365),
):
    try:
        if start_date and end_date:
            data = _enhanced.get_comprehensive_health_data_range(start_date, end_date)
            trend_series = _enhanced.get_recovery_trend_range(start_date, end_date)
        else:
            data = _enhanced.get_comprehensive_health_data_v2(days)
            trend_series = _enhanced.get_recovery_trend(days)
        recovery = {} if not data else _enhanced.analyze_recovery_patterns(data)
        try:
            pattern_details = _recovery_patterns.analyze_recovery_patterns(days)
        except Exception as _rp_ex:  # pragma: no cover
            pattern_details = {"error": "pattern_analysis_failed", "details": str(_rp_ex)}
        if isinstance(recovery, dict):
            recovery["trend_series"] = trend_series or []
            recovery["pattern_details"] = pattern_details
        else:
            recovery = {"trend_series": trend_series or [], "pattern_details": pattern_details}
        response = {
            "status": "success",
            "analysis_type": "recovery_analysis",
            "period_days": days,
            "recovery_analysis": recovery,
            "data_fetch_meta": _enhanced.last_fetch_meta,
            "timestamp": datetime.now().isoformat(),
        }
        if compare:
            if start_date and end_date:
                from datetime import datetime as _dt
                start_dt = _dt.fromisoformat(start_date)
                end_dt = _dt.fromisoformat(end_date)
                delta = end_dt - start_dt
                prev_end = (start_dt - timedelta(days=1)).date().isoformat()
                prev_start = (start_dt - delta - timedelta(days=1)).date().isoformat()
                prev_series = _enhanced.get_recovery_trend_range(prev_start, prev_end)
            else:
                prev_series = _enhanced.get_recovery_trend(days)
            response["comparison"] = {"previous_period_series": prev_series}
        return response
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/sleep/comprehensive")
def sleep_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        analysis = _sleep.analyze_sleep_efficiency(days)
        return {
            "status": "success",
            "analysis_type": "comprehensive_sleep",
            "period_days": days,
            "sleep_analysis": analysis,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/stress/comprehensive")
def stress_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        analysis = _stress.analyze_stress_patterns(days)
        return {
            "status": "success",
            "analysis_type": "comprehensive_stress",
            "period_days": days,
            "stress_analysis": analysis,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/activity/comprehensive")
def activity_comprehensive(days: int = Query(30, ge=1, le=365)):
    try:
        analysis = _activity.analyze_activity_patterns(days)
        return {
            "status": "success",
            "analysis_type": "comprehensive_activity",
            "period_days": days,
            "activity_analysis": analysis,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/correlations")
def correlations_legacy():
    try:
        query = """
        SELECT 
            d.day,
            d.mood,
            d.energy_level,
            d.sleep_quality_manual,
            g.steps,
            g.calories_burned,
            g.resting_heart_rate as rhr,
            s.sleep_score,
            (s.sleep_duration_seconds/60.0) as time_in_bed_minutes
        FROM daily_journal d
        LEFT JOIN garmin_daily_summaries g ON d.day = g.day
        LEFT JOIN garmin_sleep_sessions s ON d.day = s.day
        WHERE d.mood IS NOT NULL
        ORDER BY d.day DESC
        """
        data = execute_query(query)
        if data:
            for row in data:
                if row.get("day"):
                    row["day"] = row["day"].isoformat()
        return data or []
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

@router.get("/analytics/compare/periods")
def compare_periods(
    period1_days: int = Query(30, ge=1, le=365),
    period2_days: int = Query(30, ge=1, le=365),
    offset_days: int = Query(30, ge=0, le=365),
):
    try:
        from datetime import date as _date, timedelta as _td
        end1 = _date.today()
        start1 = end1 - _td(days=period1_days - 1)
        end2 = start1 - _td(days=offset_days)
        start2 = end2 - _td(days=period2_days - 1)
        _enh = _enhanced
        def _fetch_range(s: _date, e: _date):
            return _enh.get_comprehensive_health_data_range(s.isoformat(), e.isoformat()) or []
        def _avg(nums):
            vals = [float(x) for x in nums if x is not None]
            return (sum(vals) / len(vals)) if vals else None
        def _summarize(rows):
            keys = ["steps","calories_total","rhr","stress_avg","sleep_score","time_in_bed_minutes","mood","energy_level"]
            summary = {}
            for k in keys:
                summary[f"{k}_avg"] = _avg([r.get(k) for r in rows])
            summary["count"] = len(rows)
            return summary
        data1 = _fetch_range(start1, end1)
        data2 = _fetch_range(start2, end2)
        sum1 = _summarize(data1)
        sum2 = _summarize(data2)
        deltas = {}
        for k, v in sum1.items():
            if k.endswith("_avg"):
                v2 = sum2.get(k)
                deltas[k.replace("_avg", "_delta")] = (v - v2) if (v is not None and v2 is not None) else None
        return {
            "status": "success",
            "analysis_type": "compare_periods",
            "period1": {"start_date": start1.isoformat(), "end_date": end1.isoformat(), "days": period1_days, "metrics": sum1},
            "period2": {"start_date": start2.isoformat(), "end_date": end2.isoformat(), "days": period2_days, "metrics": sum2},
            "deltas": deltas,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)

__all__ = ["router"]

