from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
import asyncio
import os
from enhanced_analytics_engine import EnhancedHealthAnalytics
from predictive_analytics import PredictiveHealthAnalytics
from specialized_analytics import ActivityAnalytics, SleepAnalytics, StressAnalytics

router = APIRouter(tags=["insights"], prefix="/insights")
# Concurrency limiter and timeout for heavy insights
_INSIGHTS_CONCURRENCY = int(os.getenv("INSIGHTS_CONCURRENCY", "3"))
_INSIGHTS_TIMEOUT = float(os.getenv("INSIGHTS_TIMEOUT", "60"))
_SEM_INSIGHTS = asyncio.Semaphore(_INSIGHTS_CONCURRENCY)

async def _limited(fn, *args, timeout: float | None = None):
    async with _SEM_INSIGHTS:
        try:
            return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout or _INSIGHTS_TIMEOUT)
        except asyncio.TimeoutError:
            from fastapi import HTTPException
            raise HTTPException(status_code=504, detail="insights processing timeout")

_enhanced = EnhancedHealthAnalytics()
_predict = PredictiveHealthAnalytics()
_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()

@router.get("/personalized")
async def personalized_insights(days: int = Query(60, ge=7, le=365)):
    try:
        comp = await _limited(_enhanced.get_comprehensive_insights, days)
        cor = await _limited(_enhanced.calculate_advanced_correlations, (await _limited(_enhanced.get_comprehensive_health_data_v2, days)) or [])
        recov = await _limited(_enhanced.get_recovery_trend, days) or []
        sleep = await _limited(_sleep.analyze_sleep_efficiency, min(30, days))
        stress = await _limited(_stress.analyze_stress_patterns, min(30, days))
        personalized = {
            'highlights': comp.get('highlights') if isinstance(comp, dict) else None,
            'top_correlations': cor.get('top') if isinstance(cor, dict) else None,
            'recovery_trend': recov,
            'sleep_focus': sleep.get('insights') if isinstance(sleep, dict) else None,
            'stress_focus': stress.get('insights') if isinstance(stress, dict) else None,
        }
        return {
            'status': 'success',
            'analysis_type': 'personalized_insights',
            'period_days': days,
            'insights': personalized,
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimization")
async def optimization_insights(metric: str = Query("sleep_quality"), days: int = Query(60, ge=7, le=365)):
    try:
        data = await asyncio.to_thread(_enhanced.get_comprehensive_health_data_v2, days) or []
        cor = (await asyncio.to_thread(_enhanced.calculate_advanced_correlations, data)) if data else {}
        top = (cor or {}).get('top') or []
        recs = []
        for c in top[:5]:
            try:
                a, b, score = c.get('a'), c.get('b'), c.get('score')
                if not a or not b:
                    continue
                if metric.lower() in (str(a).lower(), str(b).lower()):
                    other = b if metric.lower() == str(a).lower() else a
                    recs.append({
                        'target_metric': metric,
                        'related_signal': other,
                        'rationale': f'Strong relationship with {other} (score={score})',
                        'suggestion': f'Experiment with improving {other} to move {metric} in the desired direction.'
                    })
            except Exception:
                continue
        return {
            'status': 'success',
            'analysis_type': 'optimization_insights',
            'period_days': days,
            'metric': metric,
            'optimization_factors': recs,
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
