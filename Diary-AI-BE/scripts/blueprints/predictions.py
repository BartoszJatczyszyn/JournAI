from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
import asyncio
import os
from predictive_analytics import PredictiveHealthAnalytics

router = APIRouter(tags=["predictions"], prefix="/predictions")
# Concurrency limiter and timeout for heavy predictions
_PRED_CONCURRENCY = int(os.getenv("PREDICTIONS_CONCURRENCY", "2"))
_PRED_TIMEOUT = float(os.getenv("PREDICTIONS_TIMEOUT", "45"))
_SEM_PRED = asyncio.Semaphore(_PRED_CONCURRENCY)

async def _limited(fn, *args, timeout: float | None = None):
    async with _SEM_PRED:
        try:
            return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout or _PRED_TIMEOUT)
        except asyncio.TimeoutError:
            from fastapi import HTTPException
            raise HTTPException(status_code=504, detail="prediction processing timeout")
_predict = PredictiveHealthAnalytics()

@router.get("/energy")
async def predict_energy(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        predictions = await _limited(_predict.predict_energy_levels, days_ahead)
        if isinstance(predictions, dict) and predictions.get('error'):
            return {
                'status': 'partial',
                'prediction_type': 'energy_levels',
                'days_ahead': days_ahead,
                'predictions': [],
                'message': predictions.get('error'),
                'timestamp': datetime.now().isoformat(),
            }
        return {
            'status': 'success',
            'prediction_type': 'energy_levels',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sleep")
async def predict_sleep(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        predictions = await _limited(_predict.predict_sleep_quality, days_ahead)
        if isinstance(predictions, dict) and predictions.get('error'):
            return {
                'status': 'partial',
                'prediction_type': 'sleep_quality',
                'days_ahead': days_ahead,
                'predictions': [],
                'message': predictions.get('error'),
                'timestamp': datetime.now().isoformat(),
            }
        return {
            'status': 'success',
            'prediction_type': 'sleep_quality',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mood")
async def predict_mood(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        predictions = await _limited(_predict.predict_mood_trends, days_ahead)
        return {
            'status': 'success',
            'prediction_type': 'mood_trends',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/comprehensive")
async def predict_comprehensive(days_ahead: int = Query(7, ge=1, le=60)):
    try:
        predictions = await _limited(_predict.get_comprehensive_predictions, days_ahead)
        if not isinstance(predictions, dict):
            predictions = {'error': 'Unexpected predictions format'}
        return {
            'status': 'success' if not predictions.get('error') else 'partial',
            'prediction_type': 'comprehensive',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'message': predictions.get('error'),
            'timestamp': datetime.now().isoformat(),
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
#!/usr/bin/env python3
