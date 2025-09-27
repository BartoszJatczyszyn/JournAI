#!/usr/bin/env python3
"""Insights blueprint: personalized insights and optimization.

Responsibilities:
- Provide HTTP routes for insights endpoints
- Delegate to analytics engines; light param handling only
"""
from __future__ import annotations

from datetime import datetime
from flask import Blueprint, jsonify, request

from enhanced_analytics_engine import EnhancedHealthAnalytics
from predictive_analytics import PredictiveHealthAnalytics
from specialized_analytics import ActivityAnalytics, SleepAnalytics, StressAnalytics

insights_bp = Blueprint("insights", __name__)

_enhanced = EnhancedHealthAnalytics()
_predict = PredictiveHealthAnalytics()
_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()


@insights_bp.get("/personalized")
def personalized_insights():
    """Get personalized insights built from multiple analytics outputs."""
    try:
        days = request.args.get('days', 60, type=int)
        # Gather building blocks
        comp = _enhanced.get_comprehensive_insights(days)
        cor = _enhanced.calculate_advanced_correlations(_enhanced.get_comprehensive_health_data_v2(days) or [])
        recov = _enhanced.get_recovery_trend(days) or []
        sleep = _sleep.analyze_sleep_efficiency(min(30, days))
        stress = _stress.analyze_stress_patterns(min(30, days))

        personalized = {
            'highlights': comp.get('highlights') if isinstance(comp, dict) else None,
            'top_correlations': cor.get('top') if isinstance(cor, dict) else None,
            'recovery_trend': recov,
            'sleep_focus': sleep.get('insights') if isinstance(sleep, dict) else None,
            'stress_focus': stress.get('insights') if isinstance(stress, dict) else None,
        }
        return jsonify({
            'status': 'success',
            'analysis_type': 'personalized_insights',
            'period_days': days,
            'insights': personalized,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@insights_bp.get("/optimization")
def optimization_insights():
    """Suggest optimization ideas for a selected metric using available signals."""
    try:
        metric = request.args.get('metric', 'sleep_quality')
        days = request.args.get('days', 60, type=int)

        data = _enhanced.get_comprehensive_health_data_v2(days) or []
        cor = _enhanced.calculate_advanced_correlations(data) if data else {}
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
        return jsonify({
            'status': 'success',
            'analysis_type': 'optimization_insights',
            'period_days': days,
            'metric': metric,
            'optimization_factors': recs,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500
