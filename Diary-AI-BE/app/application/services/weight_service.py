from __future__ import annotations
from typing import Optional
from datetime import date

from domain.repositories.weight import IWeightRepository

class WeightService:
	def __init__(self, repo: IWeightRepository) -> None:
		self.repo = repo

	def get_current(self) -> dict:
		row = self.repo.latest()
		if not row:
			empty = self.repo.latest_day_only()
			if not empty:
				raise LookupError("no weight data")
			day = empty.get("day")
			if hasattr(day, "isoformat"):
				day = day.isoformat()
			return {
				"day": day,
				"weight_kg": None,
				"bmi": None,
				"body_fat_percentage": None,
				"muscle_mass_kg": None,
				"body_water_percentage": None,
				"source": "garmin_weight",
			}
		day = row.get("day")
		if hasattr(day, "isoformat"):
			day = day.isoformat()
		return {
			"day": day,
			"weight_kg": row.get("weight_kg"),
			"bmi": row.get("bmi"),
			"body_fat_percentage": row.get("body_fat_percentage"),
			"muscle_mass_kg": row.get("muscle_mass_kg"),
			"body_water_percentage": row.get("body_water_percentage"),
			"source": "garmin_weight",
		}

	def get_history(self, days: int) -> list[dict]:
		days = max(1, min(int(days or 90), 365))
		rows = self.repo.history(days)
		out = []
		for r in rows:
			d = r.get("day")
			if hasattr(d, "isoformat"):
				d = d.isoformat()
			out.append({
				"day": d,
				"weight_kg": r.get("weight_kg"),
				"bmi": r.get("bmi"),
				"body_fat_percentage": r.get("body_fat_percentage"),
				"muscle_mass_kg": r.get("muscle_mass_kg"),
				"body_water_percentage": r.get("body_water_percentage"),
			})
		return out

	def stats(self) -> dict:
		rows = self.repo.history(40)
		if not rows:
			raise LookupError("no weight data")
		norm = []
		for r in rows:
			d = r.get("day")
			if hasattr(d, "isoformat"):
				d = d.isoformat()
			norm.append({"day": d, "weight_kg": r.get("weight_kg")})
		latest = norm[0]
		import statistics
		last7 = [r["weight_kg"] for r in norm[:7] if r.get("weight_kg") is not None]
		last30 = [r["weight_kg"] for r in norm[:30] if r.get("weight_kg") is not None]
		avg7 = statistics.fmean(last7) if last7 else None
		avg30 = statistics.fmean(last30) if last30 else None
		delta_from_7d = (latest["weight_kg"] - avg7) if (avg7 is not None) else None
		delta_from_30d = (latest["weight_kg"] - avg30) if (avg30 is not None) else None
		trend7_slice = list(reversed(norm[:7]))
		slope = None
		if len(trend7_slice) >= 2:
			xs = list(range(len(trend7_slice)))
			ys = [r["weight_kg"] for r in trend7_slice]
			n = len(xs)
			mean_x = sum(xs) / n
			mean_y = sum(ys) / n
			denom = sum((x - mean_x) ** 2 for x in xs)
			if denom > 0:
				slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
		return {
			"latest": latest,
			"avg_7d": avg7,
			"avg_30d": avg30,
			"delta_from_7d": delta_from_7d,
			"delta_from_30d": delta_from_30d,
			"trend_7d_slope": slope,
			"sample_sizes": {"entries_7d": len(last7), "entries_30d": len(last30)},
		}

	def correlations(self, days: int, min_abs: float = 0.0) -> dict:
		from math import sqrt
		rows = self.repo.recent_joined(max(7, min(int(days or 90), 365)))
		if not rows:
			return {"days": days, "pairs": [], "sample_size": 0}
		metrics = [
			("energy_level", "energy"),
			("mood", "mood"),
			("stress_level_manual", "stress_manual"),
			("sleep_score", "sleep_score"),
			("steps", "steps"),
			("resting_heart_rate", "resting_hr"),
		]
		weight_series = [r.get("weight_kg") for r in rows if r.get("weight_kg") is not None]
		import math
		def pearson(a, b):
			paired = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
			n = len(paired)
			if n < 3:
				return None, n
			xs = [p[0] for p in paired]
			ys = [p[1] for p in paired]
			mean_x = sum(xs) / n
			mean_y = sum(ys) / n
			num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
			den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
			den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
			if den_x == 0 or den_y == 0:
				return None, n
			return num / (den_x * den_y), n
		out = []
		for field, label in metrics:
			series = [r.get(field) for r in rows]
			r_val, n_used = pearson(weight_series, series)
			if r_val is None:
				continue
			if abs(r_val) >= float(min_abs):
				out.append({"metric": label, "pearson_r": round(r_val, 3), "n": n_used})
		out.sort(key=lambda d: abs(d["pearson_r"]), reverse=True)
		return {"days": days, "pairs": out, "sample_size": len(weight_series)}

__all__ = ["WeightService"]
