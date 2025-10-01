from __future__ import annotations
from datetime import datetime
from math import sqrt
from fastapi import APIRouter, Query, HTTPException
import time
import os
from enhanced_analytics_engine import EnhancedHealthAnalytics

router = APIRouter(tags=["trends"], prefix="/trends")
_engine = EnhancedHealthAnalytics()

_BASE_METRICS = [
    ("steps", "steps", False),
    ("energy_level", "energy_level", False),
    ("sleep_score", "sleep_score", False),
    ("rhr", "rhr", True),
    ("stress_avg", "stress_avg", True),
    ("mood", "mood", False),
]

_CACHE: dict[int, tuple[float, dict]] = {}
_CACHE_TTL = float(os.getenv("HEALTH_TRENDS_CACHE_TTL", "300"))

def _linear_regression(points: list[tuple[int, float]]):
    n = len(points)
    if n < 2:
        return None
    sum_x = sum(p[0] for p in points)
    sum_y = sum(p[1] for p in points)
    sum_xx = sum(p[0]*p[0] for p in points)
    sum_xy = sum(p[0]*p[1] for p in points)
    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        return 0.0
    slope = (n * sum_xy - sum_x * sum_y) / denom
    return slope

def _classify_direction(slope: float | None, pct_change: float | None, std: float | None):
    if slope is None or pct_change is None or std is None:
        return 'stable'
    pct_thr = 0.02 + min(0.08, 0.5 * (std / 100 if std else 0))
    slope_thr = 0.0
    if slope > slope_thr and pct_change > pct_thr:
        return 'improving'
    if slope < -slope_thr and pct_change < -pct_thr:
        return 'declining'
    return 'stable'

@router.get("/health")
def health_trends(days: int = Query(90, ge=2, le=365)):
    try:
        now = time.time()
        cached = _CACHE.get(days)
        if cached and cached[0] > now:
            return cached[1]
        data = _engine.get_comprehensive_health_data_v2(days)
        if not data:
            raise HTTPException(status_code=404, detail="No data available")
        series = sorted(data, key=lambda r: r.get('day'))
        metrics_out = {}
        overall_components = []
        metric_confidences = []
        hrv_key = None
        candidate_keys = ["hrv_smoothed", "hrv_component", "hrv_raw", "hrv_ms", "hrv"]
        for ck in candidate_keys:
            if any(r.get(ck) is not None for r in series):
                hrv_key = ck
                break
        metrics = list(_BASE_METRICS)
        if hrv_key:
            metrics.append((hrv_key, "hrv", False))
        for key, name, invert in metrics:
            vals = []
            for idx, row in enumerate(series):
                v = row.get(key)
                if v is None:
                    continue
                try:
                    fv = float(v)
                except (TypeError, ValueError):
                    continue
                vals.append((idx, fv))
            if len(vals) < 2:
                continue
            first = vals[0][1]
            last = vals[-1][1]
            pct_change = ((last - first) / abs(first)) if first not in (0, None) else None
            slope = _linear_regression(vals)
            mean = sum(v for _, v in vals) / len(vals)
            variance = sum((v - mean)**2 for _, v in vals) / max(1, (len(vals)-1))
            std = sqrt(variance) if variance > 0 else 0.0
            direction = _classify_direction(slope, pct_change, std if std else None)
            if slope is not None and std:
                scaled = slope / (std if std else 1.0)
            else:
                scaled = 0.0
            combined = 0.5 * scaled + 0.5 * (pct_change or 0)
            if invert:
                combined = -combined
            overall_components.append(max(-1.0, min(1.0, combined)))
            coverage = len(vals) / len(series)
            confidence = min(1.0, 0.5 * coverage + 0.5 * min(1.0, len(vals)/30))
            metric_confidences.append(confidence)
            recent = vals[-14:]
            recent_vals = [v for _, v in recent]
            if recent_vals:
                min_v = min(recent_vals)
                max_v = max(recent_vals)
                span = (max_v - min_v) or 1.0
                spark = [round((v - min_v)/span, 4) for v in recent_vals]
            else:
                spark = []
            metrics_out[name] = {
                'first': first,
                'last': last,
                'pct_change': pct_change,
                'slope_per_day': slope,
                'direction': direction,
                'data_points': len(vals),
                'coverage_ratio': coverage,
                'confidence': confidence,
                'sparkline': spark,
            }
        if overall_components:
            overall_score = sum(overall_components) / len(overall_components)
            if overall_score > 0.03:
                overall_direction = 'improving'
            elif overall_score < -0.03:
                overall_direction = 'declining'
            else:
                overall_direction = 'stable'
        else:
            overall_score = 0.0
            overall_direction = 'stable'
        payload = {
            'status': 'success',
            'analysis_type': 'health_trends',
            'period_days': days,
            'metrics': metrics_out,
            'overall_health_direction': overall_direction,
            'overall_score': overall_score,
            'overall_confidence': (sum(metric_confidences)/len(metric_confidences)) if metric_confidences else None,
            'timestamp': datetime.now().isoformat(),
            'cache_ttl': _CACHE_TTL,
        }
        _CACHE[days] = (now + _CACHE_TTL, payload)
        return payload
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

__all__ = ["router"]
