from __future__ import annotations
from datetime import datetime
from typing import Any, Dict
import asyncio

from application.services.predictions_service import PredictionsService
from presentation.di import di

async def energy(days_ahead: int, svc: PredictionsService | None = None) -> Dict[str, Any]:
    svc = svc or di.predictions_service()
    predictions = await asyncio.to_thread(svc.energy, days_ahead)
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

async def sleep(days_ahead: int, svc: PredictionsService | None = None) -> Dict[str, Any]:
    svc = svc or di.predictions_service()
    predictions = await asyncio.to_thread(svc.sleep, days_ahead)
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

async def mood(days_ahead: int, svc: PredictionsService | None = None) -> Dict[str, Any]:
    svc = svc or di.predictions_service()
    predictions = await asyncio.to_thread(svc.mood, days_ahead)
    return {
        'status': 'success',
        'prediction_type': 'mood_trends',
        'days_ahead': days_ahead,
        'predictions': predictions,
        'timestamp': datetime.now().isoformat(),
    }

async def comprehensive(days_ahead: int, svc: PredictionsService | None = None) -> Dict[str, Any]:
    svc = svc or di.predictions_service()
    predictions = await asyncio.to_thread(svc.comprehensive, days_ahead)
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
