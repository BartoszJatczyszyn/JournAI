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


@router.get("/analytics/running")
def running_comprehensive(
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
            raw_rows = execute_query(q) or []
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


@router.get("/analytics/debug/running_samples")
def debug_running_samples(days: int = Query(90, ge=1, le=365)):
    """Debug endpoint: return counts and common sport labels to diagnose missing running rows."""
    try:
        # total runs in window
        q_total = """
        SELECT COUNT(*) as total FROM garmin_activities
        WHERE start_time::date >= CURRENT_DATE - INTERVAL '%s days'
        """ % days
        total_res = execute_query(q_total, fetch_one=True) or {}
        total = total_res.get('total', 0)

        # runs with non-null avg_pace
        q_pace = """
        SELECT COUNT(*) as with_pace FROM garmin_activities
        WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
          AND avg_pace IS NOT NULL
          AND start_time::date >= CURRENT_DATE - INTERVAL '%s days'
        """ % days
        pace_res = execute_query(q_pace, fetch_one=True) or {}
        with_pace = pace_res.get('with_pace', 0)

        # runs with vo2_max
        q_vo2 = """
        SELECT COUNT(*) as with_vo2 FROM garmin_activities
        WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
          AND vo2_max IS NOT NULL
          AND start_time::date >= CURRENT_DATE - INTERVAL '%s days'
        """ % days
        vo2_res = execute_query(q_vo2, fetch_one=True) or {}
        with_vo2 = vo2_res.get('with_vo2', 0)

        # distinct sport labels and top 10 most recent running-like activities
        q_labels = """
        SELECT sport, COUNT(*) as cnt FROM garmin_activities
        WHERE start_time::date >= CURRENT_DATE - INTERVAL '%s days'
        GROUP BY sport ORDER BY cnt DESC LIMIT 20
        """ % days
        labels = execute_query(q_labels) or []

        q_sample = """
        SELECT sport, start_time, distance_km, avg_pace, vo2_max
        FROM garmin_activities
        WHERE start_time::date >= CURRENT_DATE - INTERVAL '%s days'
        ORDER BY start_time DESC LIMIT 20
        """ % days
        sample = execute_query(q_sample) or []

        # normalize datetimes
        for r in sample:
            if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                r['start_time'] = r['start_time'].isoformat()

        return {
            'status': 'success',
            'period_days': days,
            'total_activities': int(total or 0),
            'with_pace': int(with_pace or 0),
            'with_vo2': int(with_vo2 or 0),
            'sport_labels': labels,
            'recent_sample': sample,
        }
    except Exception as e:  # pragma: no cover
        return http_error(str(e), 500)


@router.get('/analytics/debug/raw_running_range')
def debug_raw_running_range(start_date: str = Query(..., description='YYYY-MM-DD'), end_date: str = Query(..., description='YYYY-MM-DD')):
    """Run the COALESCE range query with literal date strings inserted (no param binding) to compare results."""
    try:
        q = f"""
        SELECT activity_id, sport, start_time, day, distance, avg_pace
        FROM garmin_activities
        WHERE (LOWER(sport) = 'running' OR LOWER(sport) = 'run')
          AND (COALESCE(day, start_time::date) BETWEEN '{start_date}' AND '{end_date}')
        ORDER BY start_time DESC
        LIMIT 50
        """
        rows = execute_query(q) or []
        for r in rows:
            if r.get('start_time') and hasattr(r['start_time'], 'isoformat'):
                r['start_time'] = r['start_time'].isoformat()
            if r.get('day') and hasattr(r['day'], 'isoformat'):
                r['day'] = r['day'].isoformat()
        return {'count': len(rows), 'sample': rows[:20]}
    except Exception as e:
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


@router.get("/analytics/debug/activity_source")
def debug_activity_source():
    """Return module/file for the ActivityAnalytics instance and basic sanity info."""
    try:
        import inspect
        mod = _activity.__class__.__module__
        cls = _activity.__class__.__name__
        try:
            src = inspect.getsourcefile(_activity.__class__) or inspect.getsourcefile(__import__(mod))
        except Exception:
            src = None
        has_method = hasattr(_activity, 'analyze_running')
        return {
            'module': mod,
            'class': cls,
            'source_file': src,
            'has_analyze_running': has_method,
        }
    except Exception as e:
        return {'error': str(e)}

