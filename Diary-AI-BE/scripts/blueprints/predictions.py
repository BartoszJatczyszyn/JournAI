#!/usr/bin/env python3
"""Predictions blueprint: energy, sleep, mood and comprehensive predictions.

Responsibilities:
- Provide HTTP endpoints for prediction services
- Delegate to PredictiveHealthAnalytics
"""
from __future__ import annotations

from datetime import datetime
from flask import Blueprint, jsonify, request

from predictive_analytics import PredictiveHealthAnalytics

predictions_bp = Blueprint("predictions", __name__)
_predict = PredictiveHealthAnalytics()


@predictions_bp.get("/energy")
def predict_energy():
    try:
        days_ahead = request.args.get('days_ahead', type=int)
        if days_ahead is None:
            days_ahead = request.args.get('days', 7, type=int)
        predictions = _predict.predict_energy_levels(days_ahead)
        if isinstance(predictions, dict) and predictions.get('error'):
            return jsonify({
                'status': 'partial',
                'prediction_type': 'energy_levels',
                'days_ahead': days_ahead,
                'predictions': [],
                'message': predictions.get('error'),
                'timestamp': datetime.now().isoformat(),
            })
        return jsonify({
            'status': 'success',
            'prediction_type': 'energy_levels',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'prediction_type': 'energy_levels',
            'days_ahead': request.args.get('days_ahead', 7, type=int),
            'predictions': [],
            'message': str(e),
            'timestamp': datetime.now().isoformat(),
        })


@predictions_bp.get("/sleep")
def predict_sleep():
    try:
        days_ahead = request.args.get('days_ahead', type=int)
        if days_ahead is None:
            days_ahead = request.args.get('days', 7, type=int)
        predictions = _predict.predict_sleep_quality(days_ahead)
        if isinstance(predictions, dict) and predictions.get('error'):
            return jsonify({
                'status': 'partial',
                'prediction_type': 'sleep_quality',
                'days_ahead': days_ahead,
                'predictions': [],
                'message': predictions.get('error'),
                'timestamp': datetime.now().isoformat(),
            })
        return jsonify({
            'status': 'success',
            'prediction_type': 'sleep_quality',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'prediction_type': 'sleep_quality',
            'days_ahead': request.args.get('days_ahead', 7, type=int),
            'predictions': [],
            'message': str(e),
            'timestamp': datetime.now().isoformat(),
        })


@predictions_bp.get("/mood")
def predict_mood():
    try:
        days_ahead = request.args.get('days_ahead', 7, type=int)
        predictions = _predict.predict_mood_trends(days_ahead)
        return jsonify({
            'status': 'success',
            'prediction_type': 'mood_trends',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@predictions_bp.get("/comprehensive")
def predict_comprehensive():
    try:
        days_ahead = request.args.get('days_ahead', type=int)
        if days_ahead is None:
            days_ahead = request.args.get('days', 7, type=int)
        predictions = _predict.get_comprehensive_predictions(days_ahead)
        if not isinstance(predictions, dict):
            predictions = {'error': 'Unexpected predictions format'}
        return jsonify({
            'status': 'success' if not predictions.get('error') else 'partial',
            'prediction_type': 'comprehensive',
            'days_ahead': days_ahead,
            'predictions': predictions,
            'message': predictions.get('error'),
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'prediction_type': 'comprehensive',
            'days_ahead': request.args.get('days_ahead', 7, type=int),
            'predictions': {},
            'message': str(e),
            'timestamp': datetime.now().isoformat(),
        })
