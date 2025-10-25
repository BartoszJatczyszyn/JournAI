from __future__ import annotations
from datetime import datetime
import asyncio
from typing import Any, Dict

from application.services.analytics_service import AnalyticsService
from infrastructure.analytics import ActivityAnalytics, SleepAnalytics, StressAnalytics
from domain.repositories.activities import IActivitiesRepository
from presentation.di import di
# Note: Avoid direct DB access in controllers; use services/DI. Kept here for the legacy correlations_legacy endpoint (to be moved).
from infrastructure.analytics import EnhancedHealthAnalytics
from datetime import date as _date, timedelta as _td
import inspect

# Enhanced analytics
async def enhanced_comprehensive(days: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.analytics_service()
    return await svc.enhanced_comprehensive(days)

async def enhanced_correlations(days: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.analytics_service()
    return await svc.enhanced_correlations(days)

async def enhanced_clusters(days: int, clusters: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.analytics_service()
    return await svc.enhanced_clusters(days, clusters)

async def enhanced_temporal_patterns(days: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.analytics_service()
    return await svc.enhanced_temporal_patterns(days)

async def enhanced_recovery(compare: bool, start_date: str | None, end_date: str | None, days: int, svc=None) -> Dict[str, Any]:
    svc = svc or di.analytics_service()
    return await svc.enhanced_recovery(compare=compare, start_date=start_date, end_date=end_date, days=days)

# Classic analytics (kept here for consolidation)
async def sleep_comprehensive(days: int) -> Dict[str, Any]:
    analysis = SleepAnalytics().analyze_sleep_efficiency(days)
    return {
        "status": "success",
        "analysis_type": "comprehensive_sleep",
        "period_days": days,
        "sleep_analysis": analysis,
        "timestamp": datetime.now().isoformat(),
    }

async def stress_comprehensive(days: int) -> Dict[str, Any]:
    analysis = await asyncio.to_thread(StressAnalytics().analyze_stress_patterns, days)
    return {
        "status": "success",
        "analysis_type": "comprehensive_stress",
        "period_days": days,
        "stress_analysis": analysis,
        "timestamp": datetime.now().isoformat(),
    }

async def activity_comprehensive(days: int) -> Dict[str, Any]:
    analysis = await asyncio.to_thread(ActivityAnalytics().analyze_activity_patterns, days)
    return {
        "status": "success",
        "analysis_type": "comprehensive_activity",
        "period_days": days,
        "activity_analysis": analysis,
        "timestamp": datetime.now().isoformat(),
    }

# Debug helpers via repository
async def debug_running_counts(days: int, repo: IActivitiesRepository | None = None) -> Dict[str, Any]:
    repo = repo or di.activities_repo()
    total, with_pace = await repo.debug_counts(days)
    with_vo2 = await repo.vo2_count(days)
    labels = await repo.labels(days)
    sample = await repo.debug_sample(days)
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

async def debug_raw_running_range(start_date: str, end_date: str, repo: IActivitiesRepository | None = None) -> Dict[str, Any]:
    repo = repo or di.activities_repo()
    rows = await repo.raw_running_range(start_date, end_date)
    return {'count': len(rows), 'sample': rows[:20]}


# Legacy/utility endpoints refactored from blueprint
async def correlations_legacy(svc=None) -> list[dict[str, Any]]:
    svc = svc or di.analytics_service()
    return await svc.correlations_base_dataset()


async def compare_periods(period1_days: int, period2_days: int, offset_days: int) -> Dict[str, Any]:
    """Compare two back-to-back periods with an offset gap using enhanced engine.

    Returns averages per period and deltas for *_avg metrics.
    """
    end1 = _date.today()
    start1 = end1 - _td(days=period1_days - 1)
    end2 = start1 - _td(days=offset_days)
    start2 = end2 - _td(days=period2_days - 1)
    _enh = EnhancedHealthAnalytics()

    def _fetch_range(s: _date, e: _date):
        return _enh.get_comprehensive_health_data_range(s.isoformat(), e.isoformat()) or []

    def _avg(nums):
        vals = [float(x) for x in nums if x is not None]
        return (sum(vals) / len(vals)) if vals else None

    def _summarize(rows):
        keys = [
            "steps",
            "calories_total",
            "rhr",
            "stress_avg",
            "sleep_score",
            "time_in_bed_minutes",
            "mood",
            "energy_level",
        ]
        summary: Dict[str, Any] = {}
        for k in keys:
            summary[f"{k}_avg"] = _avg([r.get(k) for r in rows])
        summary["count"] = len(rows)
        return summary

    data1 = _fetch_range(start1, end1)
    data2 = _fetch_range(start2, end2)
    sum1 = _summarize(data1)
    sum2 = _summarize(data2)
    deltas: Dict[str, Any] = {}
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


def debug_activity_source() -> Dict[str, Any]:
    """Return module/file info for ActivityAnalytics class for diagnostics."""
    try:
        cls = ActivityAnalytics
        mod = cls.__module__
        try:
            src = inspect.getsourcefile(cls) or inspect.getsourcefile(__import__(mod))
        except Exception:
            src = None
        has_method = hasattr(cls(), 'analyze_running')
        return {
            'module': mod,
            'class': cls.__name__,
            'source_file': src,
            'has_analyze_running': has_method,
        }
    except Exception as e:
        return {'error': str(e)}
