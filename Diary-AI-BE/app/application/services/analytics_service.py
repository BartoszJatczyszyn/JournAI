from __future__ import annotations

# Re-export to align with Clean Architecture package path

__all__ = ["AnalyticsService"]

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.lib.cache import TTLCache
from app.lib.errors import NotFoundError, TimeoutExceeded
from settings import settings
from db import async_execute_query
from infrastructure.analytics import (
	EnhancedHealthAnalytics,
	RecoveryPatternAnalytics,
)

class AnalyticsService:
	"""Encapsulates analytics orchestration, caching, and throttling.

	Responsibilities:
	- Provide simple methods per endpoint (KISS)
	- Hide concurrency limiting and timeouts
	- Centralize TTL caching (SOLID: single responsibility)
	"""

	def __init__(self) -> None:
		self._enhanced = EnhancedHealthAnalytics()
		self._recovery_patterns = RecoveryPatternAnalytics()
		self._sem = asyncio.Semaphore(settings.analytics_concurrency)
		ttl = settings.analytics_cache_ttl
		self._cache = TTLCache[Dict[str, Any]](ttl)

	async def _limited(self, fn, *args, timeout: Optional[float] = None):
		timeout = timeout or settings.analytics_timeout
		async with self._sem:
			try:
				return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout)
			except asyncio.TimeoutError as e:
				raise TimeoutExceeded("analytics processing timeout") from e

	# ---- Enhanced analytics endpoints ----

	async def enhanced_comprehensive(self, days: int) -> Dict[str, Any]:
		key = f"enhanced_comprehensive:{days}"
		cached = self._cache.get(key)
		if cached:
			return cached
		insights = await self._limited(self._enhanced.get_comprehensive_insights, days)
		payload = {
			"status": "success",
			"analysis_type": "enhanced_comprehensive",
			"period_days": days,
			"insights": insights,
			"timestamp": datetime.now().isoformat(),
			"cache_ttl": settings.analytics_cache_ttl,
		}
		self._cache.set(key, payload)
		return payload

	async def enhanced_correlations(self, days: int) -> Dict[str, Any]:
		key = f"enhanced_correlations:{days}"
		cached = self._cache.get(key)
		if cached:
			return cached
		data = self._enhanced.get_comprehensive_health_data_v2(days)
		if not data:
			raise NotFoundError("No data available for correlation analysis")
		correlations = await self._limited(self._enhanced.calculate_advanced_correlations, data)
		payload = {
			"status": "success",
			"analysis_type": "enhanced_correlations",
			"period_days": days,
			"data_points": len(data),
			"correlations": correlations,
			"data_fetch_meta": self._enhanced.last_fetch_meta,
			"timestamp": datetime.now().isoformat(),
			"cache_ttl": settings.analytics_cache_ttl,
		}
		self._cache.set(key, payload)
		return payload

	async def enhanced_clusters(self, days: int, clusters: int) -> Dict[str, Any]:
		key = f"enhanced_clusters:{days}:{clusters}"
		cached = self._cache.get(key)
		if cached:
			return cached
		data = self._enhanced.get_comprehensive_health_data_v2(days)
		if not data:
			raise NotFoundError("No data available for cluster analysis")
		cluster_data = await self._limited(self._enhanced.perform_cluster_analysis, data, clusters)
		payload = {
			"status": "success",
			"analysis_type": "cluster_analysis",
			"period_days": days,
			"clusters": cluster_data,
			"data_fetch_meta": self._enhanced.last_fetch_meta,
			"timestamp": datetime.now().isoformat(),
			"cache_ttl": settings.analytics_cache_ttl,
		}
		self._cache.set(key, payload)
		return payload

	async def enhanced_temporal_patterns(self, days: int) -> Dict[str, Any]:
		key = f"enhanced_temporal:{days}"
		cached = self._cache.get(key)
		if cached:
			return cached
		data = self._enhanced.get_comprehensive_health_data_v2(days)
		if not data:
			raise NotFoundError("No data available for temporal analysis")
		patterns = await self._limited(self._enhanced.analyze_temporal_patterns, data)
		payload = {
			"status": "success",
			"analysis_type": "temporal_patterns",
			"period_days": days,
			"patterns": patterns,
			"data_fetch_meta": self._enhanced.last_fetch_meta,
			"timestamp": datetime.now().isoformat(),
			"cache_ttl": settings.analytics_cache_ttl,
		}
		self._cache.set(key, payload)
		return payload

	async def enhanced_recovery(
		self,
		*,
		compare: bool,
		start_date: Optional[str],
		end_date: Optional[str],
		days: int,
	) -> Dict[str, Any]:
		key = f"enhanced_recovery:{days}:{compare}:{start_date or ''}:{end_date or ''}"
		cached = self._cache.get(key)
		if cached:
			return cached
		if start_date and end_date:
			data = await self._limited(self._enhanced.get_comprehensive_health_data_range, start_date, end_date)
			trend_series = await self._limited(self._enhanced.get_recovery_trend_range, start_date, end_date)
		else:
			data = self._enhanced.get_comprehensive_health_data_v2(days)
			trend_series = await self._limited(self._enhanced.get_recovery_trend, days)
		recovery = {} if not data else self._enhanced.analyze_recovery_patterns(data)
		try:
			pattern_details = await self._limited(self._recovery_patterns.analyze_recovery_patterns, days)
		except Exception as _rp_ex:  # fall back with error payload
			pattern_details = {"error": "pattern_analysis_failed", "details": str(_rp_ex)}
		if isinstance(recovery, dict):
			recovery["trend_series"] = trend_series or []
			recovery["pattern_details"] = pattern_details
		else:
			recovery = {"trend_series": trend_series or [], "pattern_details": pattern_details}
		response: Dict[str, Any] = {
			"status": "success",
			"analysis_type": "recovery_analysis",
			"period_days": days,
			"recovery_analysis": recovery,
			"data_fetch_meta": self._enhanced.last_fetch_meta,
			"timestamp": datetime.now().isoformat(),
		}
		if compare:
			if start_date and end_date:
				from datetime import datetime as _dt
				start_dt = _dt.fromisoformat(start_date)
				end_dt = _dt.fromisoformat(end_date)
				delta = end_dt - start_dt
				prev_end = (start_dt - timedelta(days=1)).date().isoformat()
				prev_start = (start_dt - delta - timedelta(days=1)).date().isoformat()
				prev_series = self._enhanced.get_recovery_trend_range(prev_start, prev_end)
			else:
				prev_series = self._enhanced.get_recovery_trend(days)
			response["comparison"] = {"previous_period_series": prev_series}
		response["cache_ttl"] = settings.analytics_cache_ttl
		self._cache.set(key, response)
		return response

	# ---- Legacy base dataset moved from controller ----
	async def correlations_base_dataset(self) -> list[dict[str, Any]]:
		query = (
			"""
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
		)
		data = await async_execute_query(query)
		if data:
			for row in data:
				if row.get("day") and hasattr(row["day"], "isoformat"):
					row["day"] = row["day"].isoformat()
		return data or []

__all__ = ["AnalyticsService"]
