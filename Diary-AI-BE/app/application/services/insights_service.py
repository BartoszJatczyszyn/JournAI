from __future__ import annotations
from typing import Any, Dict, List
from infrastructure.analytics import EnhancedHealthAnalytics
from infrastructure.analytics.predictive_analytics import PredictiveHealthAnalytics
from infrastructure.analytics import ActivityAnalytics, SleepAnalytics, StressAnalytics

class InsightsService:
	def __init__(self) -> None:
		self._enhanced = EnhancedHealthAnalytics()
		self._predict = PredictiveHealthAnalytics()
		self._sleep = SleepAnalytics()
		self._stress = StressAnalytics()
		self._activity = ActivityAnalytics()

	def personalized(self, days: int) -> Dict[str, Any]:
		comp = self._enhanced.get_comprehensive_insights(days)
		cor = self._enhanced.calculate_advanced_correlations(self._enhanced.get_comprehensive_health_data_v2(days) or [])
		recov = self._enhanced.get_recovery_trend(days) or []
		sleep = self._sleep.analyze_sleep_efficiency(min(30, days))
		stress = self._stress.analyze_stress_patterns(min(30, days))
		return {
			'highlights': comp.get('highlights') if isinstance(comp, dict) else None,
			'top_correlations': cor.get('top') if isinstance(cor, dict) else None,
			'recovery_trend': recov,
			'sleep_focus': sleep.get('insights') if isinstance(sleep, dict) else None,
			'stress_focus': stress.get('insights') if isinstance(stress, dict) else None,
		}

	def optimization(self, metric: str, days: int) -> Dict[str, Any]:
		data = self._enhanced.get_comprehensive_health_data_v2(days) or []
		cor = (self._enhanced.calculate_advanced_correlations(data)) if data else {}
		top = (cor or {}).get('top') or []
		recs: List[Dict[str, Any]] = []
		for c in top[:5]:
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
		return {'metric': metric, 'optimization_factors': recs}

__all__ = ["InsightsService"]
