#!/usr/bin/env python3
"""Analytics blueprint: enhanced analytics, correlations, and specialized analyses.

Responsibilities (SRP):
- Translate HTTP requests to calls on analytics engines/services
- Validate/normalize query params, shape JSON responses

Collaborators:
- EnhancedHealthAnalytics (advanced ML analytics)
- SleepAnalytics, StressAnalytics, ActivityAnalytics (domain-specific)
- execute_query for SQL-backed views (where needed)

Design:
- No direct DB/driver coupling; uses execute_query helper
- Pure routing layer: no business logic beyond light parameter handling
"""
from __future__ import annotations

from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from http_helpers import error_response, parse_int_arg, parse_bool_arg, parse_date_arg

from db import execute_query
from enhanced_analytics_engine import EnhancedHealthAnalytics
from specialized_analytics import ActivityAnalytics, SleepAnalytics, StressAnalytics, RecoveryPatternAnalytics


analytics_bp = Blueprint("analytics", __name__)

# Engines (can be injected if needed in the future)
_enhanced = EnhancedHealthAnalytics()
_sleep = SleepAnalytics()
_stress = StressAnalytics()
_activity = ActivityAnalytics()
_recovery_patterns = RecoveryPatternAnalytics()


# ----- Enhanced analytics -----
@analytics_bp.get("/analytics/enhanced/comprehensive")
def enhanced_comprehensive():
    try:
        days = parse_int_arg('days', 90, 1, 365)
        insights = _enhanced.get_comprehensive_insights(days)
        return jsonify({
            'status': 'success',
            'analysis_type': 'enhanced_comprehensive',
            'period_days': days,
            'insights': insights,
            'timestamp': datetime.now().isoformat(),
        })
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        return error_response(str(e), 500)


@analytics_bp.get("/analytics/enhanced/correlations")
def enhanced_correlations():
    try:
        days = parse_int_arg('days', 90, 1, 365)
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return jsonify({'status': 'error', 'message': 'No data available for correlation analysis', 'data_fetch_meta': _enhanced.last_fetch_meta}), 404
        correlations = _enhanced.calculate_advanced_correlations(data)
        return jsonify({
            'status': 'success',
            'analysis_type': 'enhanced_correlations',
            'period_days': days,
            'data_points': len(data),
            'correlations': correlations,
            'data_fetch_meta': _enhanced.last_fetch_meta,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@analytics_bp.get("/analytics/enhanced/clusters")
def enhanced_clusters():
    try:
        days = parse_int_arg('days', 90, 1, 365)
        n_clusters = parse_int_arg('clusters', 3, 2, 15)
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return jsonify({'status': 'error', 'message': 'No data available for cluster analysis', 'data_fetch_meta': _enhanced.last_fetch_meta}), 404
        clusters = _enhanced.perform_cluster_analysis(data, n_clusters)
        return jsonify({
            'status': 'success',
            'analysis_type': 'cluster_analysis',
            'period_days': days,
            'clusters': clusters,
            'data_fetch_meta': _enhanced.last_fetch_meta,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@analytics_bp.get("/analytics/enhanced/temporal-patterns")
def enhanced_temporal_patterns():
    try:
        days = parse_int_arg('days', 90, 1, 365)
        data = _enhanced.get_comprehensive_health_data_v2(days)
        if not data:
            return jsonify({'status': 'error', 'message': 'No data available for temporal analysis', 'data_fetch_meta': _enhanced.last_fetch_meta}), 404
        patterns = _enhanced.analyze_temporal_patterns(data)
        return jsonify({
            'status': 'success',
            'analysis_type': 'temporal_patterns',
            'period_days': days,
            'patterns': patterns,
            'data_fetch_meta': _enhanced.last_fetch_meta,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@analytics_bp.get("/analytics/enhanced/recovery")
def enhanced_recovery():
    try:
        compare = parse_bool_arg('compare', False)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        days = parse_int_arg('days', 90, 1, 365)
        if start_date and end_date:
            data = _enhanced.get_comprehensive_health_data_range(start_date, end_date)
            trend_series = _enhanced.get_recovery_trend_range(start_date, end_date)
        else:
            data = _enhanced.get_comprehensive_health_data_v2(days)
            trend_series = _enhanced.get_recovery_trend(days)
        recovery = {} if not data else _enhanced.analyze_recovery_patterns(data)
        # Extended pattern analysis (non-ML) for richer decomposition
        try:
            pattern_details = _recovery_patterns.analyze_recovery_patterns(days)
        except Exception as _rp_ex:  # pragma: no cover
            pattern_details = {'error': 'pattern_analysis_failed', 'details': str(_rp_ex)}
        if isinstance(recovery, dict):
            recovery['trend_series'] = trend_series or []
            recovery['pattern_details'] = pattern_details
        else:
            recovery = {'trend_series': trend_series or [], 'pattern_details': pattern_details}
        response = {
            'status': 'success',
            'analysis_type': 'recovery_analysis',
            'period_days': days,
            'recovery_analysis': recovery,
            'data_fetch_meta': _enhanced.last_fetch_meta,
            'timestamp': datetime.now().isoformat(),
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
            response['comparison'] = {'previous_period_series': prev_series}
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


# ----- Specialized domain analytics -----
@analytics_bp.get("/analytics/sleep/comprehensive")
def sleep_comprehensive():
    try:
        days = parse_int_arg('days', 30, 1, 365)
        analysis = _sleep.analyze_sleep_efficiency(days)
        return jsonify({
            'status': 'success',
            'analysis_type': 'comprehensive_sleep',
            'period_days': days,
            'sleep_analysis': analysis,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@analytics_bp.get("/analytics/stress/comprehensive")
def stress_comprehensive():
    try:
        days = parse_int_arg('days', 30, 1, 365)
        analysis = _stress.analyze_stress_patterns(days)
        return jsonify({
            'status': 'success',
            'analysis_type': 'comprehensive_stress',
            'period_days': days,
            'stress_analysis': analysis,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@analytics_bp.get("/analytics/activity/comprehensive")
def activity_comprehensive():
    try:
        days = parse_int_arg('days', 30, 1, 365)
        analysis = _activity.analyze_activity_patterns(days)
        return jsonify({
            'status': 'success',
            'analysis_type': 'comprehensive_activity',
            'period_days': days,
            'activity_analysis': analysis,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


# ----- Legacy correlations (v3 compatible) -----
@analytics_bp.get("/analytics/correlations")
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
                if row.get('day'):
                    row['day'] = row['day'].isoformat()
        return jsonify(data or [])
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


# ----- Compare periods (used by frontend) -----
@analytics_bp.get("/analytics/compare/periods")
def compare_periods():
    """Compare two time periods for key health metrics.

    Query params:
      - period1_days: int (default 30)
      - period2_days: int (default 30)
      - offset_days: int (default 30)  # gap between the end of period1 and end of period2
    """
    try:
        from datetime import date as _date, timedelta as _td
        period1_days = parse_int_arg('period1_days', 30, 1, 365)
        period2_days = parse_int_arg('period2_days', 30, 1, 365)
        offset_days = parse_int_arg('offset_days', 30, 0, 365)

        

        # Define windows relative to today (DB max-date variant can be added later if needed)
        end1 = _date.today()
        start1 = end1 - _td(days=period1_days - 1)
        end2 = start1 - _td(days=offset_days)
        start2 = end2 - _td(days=period2_days - 1)

        # Fetch data via enhanced analytics engine (already available above)
        # We import locally to keep blueprint import surface minimal
        from enhanced_analytics_engine import EnhancedHealthAnalytics  # type: ignore
        _enh = _enhanced if '_enhanced' in globals() else EnhancedHealthAnalytics()

        def _fetch_range(s: _date, e: _date):
            return _enh.get_comprehensive_health_data_range(s.isoformat(), e.isoformat()) or []

        def _avg(nums):
            vals = [float(x) for x in nums if x is not None]
            return (sum(vals) / len(vals)) if vals else None

        def _summarize(rows):
            # Known keys produced by comprehensive dataset where available
            keys = [
                'steps', 'calories_total', 'rhr', 'stress_avg', 'sleep_score',
                'time_in_bed_minutes', 'mood', 'energy_level'
            ]
            summary = {}
            for k in keys:
                summary[f'{k}_avg'] = _avg([r.get(k) for r in rows])
            summary['count'] = len(rows)
            return summary

        data1 = _fetch_range(start1, end1)
        data2 = _fetch_range(start2, end2)
        sum1 = _summarize(data1)
        sum2 = _summarize(data2)

        # Compute deltas (period1 - period2) for *_avg metrics
        deltas = {}
        for k, v in sum1.items():
            if k.endswith('_avg'):
                v2 = sum2.get(k)
                deltas[k.replace('_avg', '_delta')] = (v - v2) if (v is not None and v2 is not None) else None

        payload = {
            'status': 'success',
            'analysis_type': 'compare_periods',
            'period1': {
                'start_date': start1.isoformat(),
                'end_date': end1.isoformat(),
                'days': period1_days,
                'metrics': sum1,
            },
            'period2': {
                'start_date': start2.isoformat(),
                'end_date': end2.isoformat(),
                'days': period2_days,
                'metrics': sum2,
            },
            'deltas': deltas,
            'timestamp': datetime.now().isoformat(),
        }
        return jsonify(payload)
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500
