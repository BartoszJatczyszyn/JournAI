from __future__ import annotations
from typing import Any, Dict
from datetime import datetime
import asyncio

from application.services.analytics_service import AnalyticsService
from application.services.insights_service import InsightsService
from presentation.di import di

async def personalized(days: int, svc: InsightsService | None = None) -> Dict[str, Any]:
    # Keep same concurrency/timeouts as blueprint helper existed
    svc = svc or di.insights_service()
    return {
        'status': 'success',
        'analysis_type': 'personalized_insights',
        'period_days': days,
        'insights': svc.personalized(days),
        'timestamp': datetime.now().isoformat(),
    }

async def optimization(metric: str, days: int, svc: InsightsService | None = None) -> Dict[str, Any]:
    svc = svc or di.insights_service()
    res = await asyncio.to_thread(svc.optimization, metric, days)
    return {
        'status': 'success',
        'analysis_type': 'optimization_insights',
        'period_days': days,
        'metric': metric,
        'optimization_factors': res.get('optimization_factors', []),
        'timestamp': datetime.now().isoformat(),
    }
