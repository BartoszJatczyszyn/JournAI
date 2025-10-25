from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from db import execute_query
from application.services.journal_service import JournalService


class JournalAnalyticsService:
    """Encapsulates analytics on top of journal entries.

    Provides:
    - context(day, window): suggestions, small forecasts, and series
    - correlations(start, end, method, min_abs): correlation matrix and pairs
    - recovery_composite(start, end, ...): weighted composite recovery score
    """

    # ---- Context helpers ----
    def _fetch_last_days(self, day: date, window: int = 7) -> List[Dict[str, Any]]:
        query = (
            """
        SELECT day, mood, stress_level, energy_level, focus_level, productivity_score,
               sleep_quality_rating, soreness_level, social_interactions_quality,
               digestion_quality, workout_intensity_rating, hrv_manual, resting_hr_manual
        FROM daily_journal
        WHERE day BETWEEN %s - INTERVAL '%s day' AND %s
        ORDER BY day
        """
        )
        rows = execute_query(query, (day, window - 1, day), fetch_all=True) or []
        for r in rows:
            d = r.get("day")
            if d and hasattr(d, "isoformat"):
                r["day"] = d.isoformat()
        return rows

    @staticmethod
    def _predict_energy(last_rows: List[Dict[str, Any]]) -> float | None:
        values = [r.get("energy_level") for r in last_rows if r.get("energy_level") is not None]
        if not values:
            return None
        recent = values[-3:] if len(values) >= 3 else values
        avg = sum(recent) / len(recent)
        return round(avg * 0.85 + 3.0 * 0.15, 2)

    @staticmethod
    def _suggest_field(field: str, rows: List[Dict[str, Any]], current: Dict[str, Any]) -> float | None:
        hist = [r.get(field) for r in rows[:-1] if r.get(field) is not None]
        if not hist:
            return None
        base_avg = sum(hist[-5:]) / min(5, len(hist))
        cur = current.get(field)
        if cur is None or abs(cur - base_avg) >= 1:
            return round(base_avg, 2)
        return None

    @staticmethod
    def _generate_summary(entry: Dict[str, Any], pred: float | None) -> str:
        parts: List[str] = []
        mood = entry.get("mood")
        energy = entry.get("energy_level")
        stress = entry.get("stress_level")
        sleepq = entry.get("sleep_quality_rating")
        productivity = entry.get("productivity_score")
        if energy is not None and mood is not None:
            if energy >= 4 and mood >= 4:
                parts.append("High energy & mood")
            elif energy <= 2 and mood <= 2:
                parts.append("Low energy & mood — rest")
            elif energy >= 4 and mood <= 2:
                parts.append("Energy > mood (mental recovery?)")
        if stress is not None and stress >= 4:
            parts.append("Elevated stress")
        if sleepq is not None and energy is not None:
            if sleepq >= 4 and energy <= 2:
                parts.append("Good sleep but low energy")
            elif sleepq <= 2 and energy >= 4:
                parts.append("Poor sleep yet good energy")
        if productivity is not None and energy is not None and (productivity - energy) >= 2:
            parts.append("High productivity vs energy")
        if pred is not None:
            if pred <= 2:
                parts.append("Tomorrow energy forecast low")
            elif pred >= 4:
                parts.append("Tomorrow energy forecast high")
        return "; ".join(parts) if parts else "Stable day."

    # ---- Public API ----
    def context(self, day: date, window: int = 7) -> Dict[str, Any]:
        svc = JournalService()
        entry = svc.get_entry(day) or {"day": day.isoformat()}
        rows = self._fetch_last_days(day, window)
        if rows and rows[-1].get("day") != entry.get("day"):
            rows.append(entry)
        prediction = self._predict_energy(rows)
        suggestion_targets = [
            "mood",
            "stress_level",
            "energy_level",
            "focus_level",
            "productivity_score",
            "sleep_quality_rating",
            "soreness_level",
            "social_interactions_quality",
            "digestion_quality",
            "workout_intensity_rating",
        ]
        suggestions: Dict[str, float] = {}
        for f in suggestion_targets:
            s = self._suggest_field(f, rows, entry)
            if s is not None:
                suggestions[f] = s
        series: Dict[str, List[Dict[str, Any]]] = {}
        for f in suggestion_targets:
            seq: List[Dict[str, Any]] = []
            for r in rows:
                if r.get(f) is not None:
                    seq.append({"day": r["day"], "value": r.get(f)})
            if seq:
                series[f] = seq[-window:]
        considered = suggestion_targets + ["hrv_manual", "resting_hr_manual"]
        filled = sum(1 for f in considered if entry.get(f) is not None)
        completeness = round(100 * filled / len(considered), 1) if considered else 0.0
        summary = self._generate_summary(entry, prediction)
        return {
            "day": entry.get("day"),
            "entry": entry,
            "last_window": series,
            "predicted": {"energy_level": prediction},
            "suggestions": suggestions,
            "summary_text": summary,
            "completeness_pct": completeness,
            "window": window,
        }

    def correlations(self, start: date, end: date, method: str = "pearson", min_abs: float = 0.0) -> Dict[str, Any]:
        import pandas as pd  # type: ignore
        import numpy as np  # type: ignore

        if start > end:
            raise ValueError("start must be <= end")
        query = (
            """
        SELECT day,
               mood, stress_level, energy_level, focus_level, productivity_score,
               sleep_quality_rating, soreness_level, social_interactions_quality,
               digestion_quality, workout_intensity_rating,
               hrv_manual, resting_hr_manual,
               water_intake_ml, caffeine_mg, fasting_hours,
               screen_time_minutes, outside_time_minutes, reading_time_minutes,
               meditated::int, calories_controlled::int, night_snacking::int, sweet_cravings::int,
               steps_goal_achieved::int, journaling_done::int, stretching_mobility_done::int
        FROM daily_journal
        WHERE day BETWEEN %s AND %s
        ORDER BY day
        """
        )
        rows = execute_query(query, (start, end), fetch_all=True) or []
        if not rows:
            return {"matrix": {}, "pairs": [], "count": 0}
        df = pd.DataFrame(rows)
        numeric_cols = [c for c in df.columns if c != "day" and pd.api.types.is_numeric_dtype(df[c])]
        sufficient = [c for c in numeric_cols if df[c].dropna().shape[0] >= 5]
        if not sufficient:
            return {"matrix": {}, "pairs": [], "count": 0}
        corr = df[sufficient].corr(method=method)
        samples_per_column = {c: int(df[c].dropna().shape[0]) for c in sufficient}
        matrix: Dict[str, Dict[str, Optional[float]]] = {}
        for c in corr.columns:
            matrix[c] = {}
            for r_col, v in corr[c].items():
                matrix[c][r_col] = (None if pd.isna(v) else float(round(v, 4)))
        rating_cols = {
            "mood",
            "stress_level",
            "energy_level",
            "focus_level",
            "productivity_score",
            "sleep_quality_rating",
            "soreness_level",
            "social_interactions_quality",
            "digestion_quality",
            "workout_intensity_rating",
        }
        metric_cols = {
            "hrv_manual",
            "resting_hr_manual",
            "water_intake_ml",
            "caffeine_mg",
            "fasting_hours",
            "screen_time_minutes",
            "outside_time_minutes",
            "reading_time_minutes",
        }
        flag_cols = {
            "meditated",
            "calories_controlled",
            "night_snacking",
            "sweet_cravings",
            "steps_goal_achieved",
            "journaling_done",
            "stretching_mobility_done",
        }
        categories: Dict[str, str] = {}
        for c in sufficient:
            if c in rating_cols:
                categories[c] = "ratings"
            elif c in metric_cols:
                categories[c] = "metrics"
            elif c in flag_cols:
                categories[c] = "flags"
            else:
                categories[c] = "other"
        pairs: List[Dict[str, Any]] = []
        for i, c1 in enumerate(corr.columns):
            for c2 in corr.columns[i + 1 :]:
                v = corr.loc[c1, c2]
                if pd.isna(v):
                    continue
                n_pair = int(df[[c1, c2]].dropna().shape[0])
                v_round = float(round(v, 4))
                if abs(v_round) < min_abs:
                    continue
                pairs.append({"a": c1, "b": c2, "value": v_round, "n": n_pair})
        return {
            "matrix": matrix,
            "pairs": pairs,
            "count": len(df),
            "columns": sufficient,
            "method": method,
            "samples_per_column": samples_per_column,
            "categories": categories,
            "min_abs": min_abs,
        }

    def recovery_composite(
        self,
        start: date,
        end: date,
        hrv_manual_weight: float = 0.3,
        sleep_weight: float = 0.25,
        stress_weight: float = 0.2,
        energy_weight: float = 0.15,
        mood_weight: float = 0.1,
    ) -> Dict[str, Any]:
        import pandas as pd  # type: ignore

        if start > end:
            raise ValueError("start must be <= end")
        weights = [hrv_manual_weight, sleep_weight, stress_weight, energy_weight, mood_weight]
        if sum(weights) <= 0:
            raise ValueError("weights must sum > 0")
        total_w = sum(weights)
        w_hrv_manual, w_sleep, w_stress, w_energy, w_mood = [w / total_w for w in weights]
        query = (
            """
        SELECT day, hrv_manual, sleep_quality_rating, stress_level, energy_level, mood
        FROM daily_journal
        WHERE day BETWEEN %s AND %s
        ORDER BY day
        """
        )
        rows = execute_query(query, (start, end), fetch_all=True) or []
        if not rows:
            return {"data": [], "count": 0}
        df = pd.DataFrame(rows)

        def norm_series(series, fn):
            return series.apply(lambda x: fn(x) if x is not None else None)

        def norm_hrv_manual(x):
            if x is None:
                return None
            x2 = max(20, min(150, x))
            return (x2 - 20) / 130.0

        df["hrv_manual_norm"] = norm_series(df.get("hrv_manual"), norm_hrv_manual)
        df["sleep_norm"] = norm_series(df.get("sleep_quality_rating"), lambda v: v / 5.0 if v is not None else None)
        df["energy_norm"] = norm_series(df.get("energy_level"), lambda v: v / 5.0 if v is not None else None)
        df["mood_norm"] = norm_series(df.get("mood"), lambda v: v / 5.0 if v is not None else None)
        df["stress_norm"] = norm_series(df.get("stress_level"), lambda v: v / 5.0 if v is not None else None)

        scores: List[Optional[float]] = []  # type: ignore[name-defined]
        for _, row in df.iterrows():
            hrv_n = row.get("hrv_manual_norm")
            slp_n = row.get("sleep_norm")
            str_n = row.get("stress_norm")
            eng_n = row.get("energy_norm")
            mood_n = row.get("mood_norm")
            comp: List[float] = []
            dyn_weights: List[float] = []
            if hrv_n is not None:
                comp.append(hrv_n)
                dyn_weights.append(w_hrv_manual)
            if slp_n is not None:
                comp.append(slp_n)
                dyn_weights.append(w_sleep)
            if str_n is not None:
                comp.append(1 - str_n)
                dyn_weights.append(w_stress)
            if eng_n is not None:
                comp.append(eng_n)
                dyn_weights.append(w_energy)
            if mood_n is not None:
                comp.append(mood_n)
                dyn_weights.append(w_mood)
            if not comp:
                score = None
            else:
                w_sum = sum(dyn_weights)
                normed_weights = [w / w_sum for w in dyn_weights]
                score = sum(c * w for c, w in zip(comp, normed_weights)) * 100.0
            scores.append(score)

        df["recovery_score"] = scores
        out: List[Dict[str, Any]] = []
        for _, row in df.iterrows():
            out.append(
                {
                    "day": row["day"].isoformat() if hasattr(row["day"], "isoformat") else row["day"],
                    "recovery_score": (None if row["recovery_score"] is None else round(float(row["recovery_score"]), 2)),
                    "components": {
                        "hrv_manual_norm": row.get("hrv_manual_norm"),
                        "sleep_norm": row.get("sleep_norm"),
                        "energy_norm": row.get("energy_norm"),
                        "mood_norm": row.get("mood_norm"),
                        "stress_norm": row.get("stress_norm"),
                    },
                }
            )

        return {
            "data": out,
            "weights": {
                "hrv_manual": w_hrv_manual,
                "sleep_quality_rating": w_sleep,
                "stress_level": w_stress,
                "energy_level": w_energy,
                "mood": w_mood,
            },
            "count": len(out),
        }


__all__ = ["JournalAnalyticsService"]
