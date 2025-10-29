from __future__ import annotations
from typing import Optional, Sequence

from domain.repositories.strength import IStrengthRepository


def epley_e1rm(weight: float, reps: int) -> float:
    if weight is None or reps is None:
        return 0.0
    if reps <= 1:
        return float(weight)
    return float(weight) * (1.0 + (float(reps) / 30.0))


def set_volume(weight: float, reps: int, is_warmup: bool) -> float:
    if is_warmup or weight is None or reps is None:
        return 0.0
    return float(weight) * float(reps)


class StrengthService:
    def __init__(self, repo: IStrengthRepository) -> None:
        self.repo = repo

    # --- helpers ---
    @staticmethod
    def _linear_regression(points: list[tuple[float, float]]) -> dict:
        # points: [(x,y)] ; requires at least 2
        if not points or len(points) < 2:
            return {"slope": 0.0, "intercept": 0.0, "r2": 0.0}
        n = float(len(points))
        sum_x = sum(p[0] for p in points)
        sum_y = sum(p[1] for p in points)
        sum_xy = sum(p[0]*p[1] for p in points)
        sum_xx = sum(p[0]*p[0] for p in points)
        denom = n*sum_xx - sum_x*sum_x
        if denom == 0:
            return {"slope": 0.0, "intercept": 0.0, "r2": 0.0}
        slope = (n*sum_xy - sum_x*sum_y) / denom
        intercept = (sum_y - slope*sum_x) / n
        # r^2
        mean_y = sum_y / n
        ss_tot = sum((p[1]-mean_y)**2 for p in points)
        ss_res = sum((p[1] - (slope*p[0] + intercept))**2 for p in points)
        r2 = (1 - (ss_res/ss_tot)) if ss_tot else 0.0
        return {"slope": float(slope), "intercept": float(intercept), "r2": float(r2)}

    # Catalog
    def list_muscle_groups(self) -> list[dict]:
        return self.repo.list_muscle_groups()

    def search_exercises(self, *, query: str | None, muscle_group_id: int | None) -> list[dict]:
        return self.repo.search_exercises(query=query, muscle_group_id=muscle_group_id)

    def list_exercises(self) -> list[dict]:
        return self.repo.list_exercises()

    # Workouts
    def save_workout(self, payload: dict) -> dict:
        # compute derived metrics client-side if needed later; for now just persist
        return self.repo.create_workout(payload)

    def get_workout(self, workout_id: int) -> Optional[dict]:
        return self.repo.get_workout(workout_id)

    def list_workouts(self, *, limit: int = 50, offset: int = 0) -> list[dict]:
        return self.repo.list_workouts(limit=limit, offset=offset)

    def update_workout(self, workout_id: int, payload: dict) -> dict:
        return self.repo.update_workout(workout_id, payload)

    def delete_workout(self, workout_id: int) -> bool:
        return self.repo.delete_workout(workout_id)

    # Metrics
    def exercise_log_metrics(self, exercise_log: dict) -> dict:
        volumes = [set_volume(s.get("weight", 0) or 0, s.get("reps", 0) or 0, bool(s.get("is_warmup", False))) for s in exercise_log.get("sets", [])]
        e1rms = [epley_e1rm(s.get("weight", 0) or 0, s.get("reps", 0) or 0) for s in exercise_log.get("sets", []) if not s.get("is_warmup", False)]
        return {
            "totalVolume": round(sum(volumes), 2),
            "bestE1RM": round(max(e1rms) if e1rms else 0.0, 2),
        }

    def session_muscle_group_volumes(self, workout: dict) -> dict:
        # Build map primary MG -> volume; ignore secondary for initial version
        mg_map: dict[int, float] = {}
        # prefetch exercise meta
        ex_by_id = {ex["id"]: ex for ex in self.repo.list_exercises()}
        for log in workout.get("exercises", []) or []:
            ex_def = ex_by_id.get(log.get("exercise_definition_id") or log.get("exerciseDefinitionId"))
            if not ex_def:
                continue
            vol = self.exercise_log_metrics(log)["totalVolume"]
            pmg = ex_def.get("primary_muscle_group_id")
            if pmg:
                mg_map[pmg] = mg_map.get(pmg, 0.0) + vol
        return mg_map

    # Suggestions
    def suggestion_for_next(self, *, exercise_definition_id: int) -> Optional[dict]:
        last = self.repo.last_exercise_log(exercise_definition_id)
        if not last or not last.get("sets"):
            return None
        # Aggregate basic pattern: detect typical scheme (same reps/weight across working sets)
        working_sets = [s for s in last["sets"] if not s.get("is_warmup", False)]
        if not working_sets:
            return None
        # Use first set as baseline
        first = working_sets[0]
        reps = int(first.get("reps") or 0)
        weight = float(first.get("weight") or 0)
        sets_count = len(working_sets)

        # Simple improved logic: if average reps >= 8 and avg RPE <= 8 -> increase weight; else increase reps; if sets<4 -> consider extra set
        avg_reps = sum(int(s.get("reps") or 0) for s in working_sets) / max(1, len(working_sets))
        rpes = [float(s.get("rpe")) for s in working_sets if s.get("rpe") is not None]
        avg_rpe = sum(rpes) / len(rpes) if rpes else 8.0

        suggestions: list[str] = []
        if avg_reps >= 8 and avg_rpe <= 8.0:
            suggestions.append(f"Try today: {sets_count}x{reps} @ {round(weight + 2.5, 2)} kg")
        else:
            suggestions.append(f"Try today: {sets_count}x{reps+1} @ {round(weight, 2)} kg (at least on first set)")
        if sets_count < 4:
            suggestions.append(f"Optional: {sets_count+1}x{reps} @ {round(weight, 2)} kg")

        return {
            "last": {
                "sets": sets_count,
                "reps": reps,
                "weight": weight,
                "startedAt": last.get("started_at") or last.get("start_time"),
                "avgReps": round(avg_reps, 2),
                "avgRPE": round(avg_rpe, 2),
            },
            "suggestions": suggestions,
        }

    def exercise_stats(self, exercise_definition_id: int) -> dict:
        # type: ignore[attr-defined]
        if hasattr(self.repo, "exercise_stats"):
            return self.repo.exercise_stats(exercise_definition_id)  # type: ignore[misc]
        return {"series": []}

    def muscle_group_weekly_volume(self, muscle_group_id: int, weeks: int = 12) -> dict:
        if hasattr(self.repo, "muscle_group_weekly_volume"):
            rows = self.repo.muscle_group_weekly_volume(muscle_group_id, weeks)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def exercise_contribution_last_month(self, muscle_group_id: int, days: int = 30) -> dict:
        if hasattr(self.repo, "exercise_contribution_last_month"):
            rows = self.repo.exercise_contribution_last_month(muscle_group_id, days)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def weekly_training_frequency(self, muscle_group_id: int, weeks: int = 12) -> dict:
        if hasattr(self.repo, "weekly_training_frequency"):
            rows = self.repo.weekly_training_frequency(muscle_group_id, weeks)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def exercise_history(self, exercise_definition_id: int, limit: int = 20) -> dict:
        if hasattr(self.repo, "exercise_history"):
            rows = self.repo.exercise_history(exercise_definition_id, limit)  # type: ignore[misc]
            return {"items": rows}
        return {"items": []}

    # Aggregated analytics for dashboard and charts
    def exercise_e1rm_progress(self, exercise_definition_id: int) -> dict:
        if hasattr(self.repo, "exercise_e1rm_progress"):
            rows = self.repo.exercise_e1rm_progress(exercise_definition_id)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def workouts_volume_series(self, days: int = 90) -> dict:
        if hasattr(self.repo, "workouts_volume_series"):
            rows = self.repo.workouts_volume_series(days)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def exercise_summary(self, exercise_definition_id: int, days: int = 180) -> dict:
        # Summarize progress using e1RM time series: slope (per point index), r2, last PR, last PR date
        if hasattr(self.repo, "exercise_e1rm_progress"):
            series = self.repo.exercise_e1rm_progress(exercise_definition_id)  # type: ignore[misc]
        else:
            series = []
        ys = [float(row.get("best_e1rm") or 0) for row in series]
        points = [(float(i), y) for i, y in enumerate(ys) if y > 0]
        reg = self._linear_regression(points)
        last_pr = 0.0
        last_pr_date = None
        if ys:
            max_val = max(ys)
            last_pr = float(max_val)
            # find last occurrence date of max
            for row in reversed(series):
                if float(row.get("best_e1rm") or 0) == max_val:
                    last_pr_date = row.get("day")
                    break
        return {
            "points": len(points),
            "slope": round(reg["slope"], 4),
            "r2": round(reg["r2"], 4),
            "lastPR": round(last_pr, 2),
            "lastPRDate": last_pr_date,
        }

    def top_progress(self, days: int = 90, limit: int = 5) -> dict:
        # Compute slope per exercise and return top ascending trends
        if hasattr(self.repo, "all_exercises_e1rm_progress"):
            rows = self.repo.all_exercises_e1rm_progress(days)  # type: ignore[misc]
        else:
            rows = []
        # Group by exercise id
        by_ex: dict[int, list[dict]] = {}
        for r in rows:
            ex_id = int(r.get("exercise_definition_id"))
            by_ex.setdefault(ex_id, []).append(r)
        # Build id->name map
        names = {ex["id"]: ex["name"] for ex in self.repo.list_exercises()}
        items = []
        for ex_id, series in by_ex.items():
            ys = [float(row.get("best_e1rm") or 0) for row in series]
            points = [(float(i), y) for i, y in enumerate(ys) if y > 0]
            if len(points) < 3:
                continue
            reg = self._linear_regression(points)
            if reg["slope"] <= 0:
                continue
            max_val = max(ys) if ys else 0.0
            last_date = None
            if ys:
                for row in reversed(series):
                    if float(row.get("best_e1rm") or 0) == max_val:
                        last_date = row.get("day")
                        break
            items.append({
                "exerciseId": ex_id,
                "name": names.get(ex_id, f"Exercise {ex_id}"),
                "slope": round(float(reg["slope"]), 4),
                "r2": round(float(reg["r2"]), 4),
                "lastPR": round(float(max_val), 2),
                "lastPRDate": last_date,
                "points": len(points),
            })
        items.sort(key=lambda x: x["slope"], reverse=True)
        return {"items": items[: max(1, int(limit))]}

    def correlations(self, days: int = 90) -> dict:
        # Correlate daily total strength volume with basic training load proxies: logs_count and sets_count
        if hasattr(self.repo, "workouts_volume_series"):
            vol = self.repo.workouts_volume_series(days)  # type: ignore[misc]
        else:
            vol = []
        if hasattr(self.repo, "daily_strength_counts"):
            counts = self.repo.daily_strength_counts(days)  # type: ignore[misc]
        else:
            counts = []
        vmap = {str(r["day"]): float(r.get("total_volume") or 0) for r in vol}
        cmap = {str(r["day"]): {"logs": int(r.get("logs_count") or 0), "sets": int(r.get("sets_count") or 0)} for r in counts}
        # Build aligned arrays
        xs_logs, ys_logs = [], []
        xs_sets, ys_sets = [], []
        for day, v in vmap.items():
            c = cmap.get(day)
            if not c:
                continue
            xs_logs.append(v)
            ys_logs.append(float(c["logs"]))
            xs_sets.append(v)
            ys_sets.append(float(c["sets"]))
        def pearson(x, y):
            n = len(x)
            if n < 2:
                return 0.0
            sx = sum(x); sy = sum(y)
            sxx = sum(a*a for a in x); syy = sum(b*b for b in y); sxy = sum(a*b for a,b in zip(x,y))
            denom = (n*sxx - sx*sx) * (n*syy - sy*sy)
            if denom <= 0:
                return 0.0
            return float((n*sxy - sx*sy) / (denom ** 0.5))
        return {
            "volume_vs_logs": round(pearson(xs_logs, ys_logs), 3),
            "volume_vs_sets": round(pearson(xs_sets, ys_sets), 3),
            "points": min(len(xs_logs), len(xs_sets)),
            "scatter_logs": [{"x": x, "y": y} for x,y in zip(xs_logs, ys_logs)],
            "scatter_sets": [{"x": x, "y": y} for x,y in zip(xs_sets, ys_sets)],
        }

    # Templates
    def list_templates(self) -> list[dict]:
        if hasattr(self.repo, "list_templates"):
            return self.repo.list_templates()  # type: ignore[misc]
        return []

    def upsert_template(self, tpl: dict) -> dict:
        if hasattr(self.repo, "upsert_template"):
            return self.repo.upsert_template(tpl)  # type: ignore[misc]
        return tpl

    def delete_template(self, tpl_id: str) -> bool:
        if hasattr(self.repo, "delete_template"):
            return self.repo.delete_template(tpl_id)  # type: ignore[misc]
        return False

__all__ = ["StrengthService", "epley_e1rm", "set_volume"]
