from __future__ import annotations
from typing import Any, Dict
from infrastructure.analytics.predictive_analytics import PredictiveHealthAnalytics

class PredictionsService:
	def __init__(self) -> None:
		self._predict = PredictiveHealthAnalytics()

	def energy(self, days_ahead: int) -> Any:
		return self._predict.predict_energy_levels(days_ahead)

	def sleep(self, days_ahead: int) -> Any:
		return self._predict.predict_sleep_quality(days_ahead)

	def mood(self, days_ahead: int) -> Any:
		return self._predict.predict_mood_trends(days_ahead)

	def comprehensive(self, days_ahead: int) -> Dict[str, Any]:
		res = self._predict.get_comprehensive_predictions(days_ahead)
		return res if isinstance(res, dict) else {"error": "Unexpected predictions format"}

__all__ = ["PredictionsService"]
