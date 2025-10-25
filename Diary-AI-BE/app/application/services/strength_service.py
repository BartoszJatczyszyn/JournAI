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

    def list_workouts(self, *, limit: int = 50, offset: int = 0, user_id: str | None = None) -> list[dict]:
        return self.repo.list_workouts(limit=limit, offset=offset, user_id=user_id)

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
    def suggestion_for_next(self, *, exercise_definition_id: int, user_id: str) -> Optional[dict]:
        last = self.repo.last_exercise_log(exercise_definition_id, user_id)
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
                "startedAt": last.get("started_at"),
                "avgReps": round(avg_reps, 2),
                "avgRPE": round(avg_rpe, 2),
            },
            "suggestions": suggestions,
        }

    def exercise_stats(self, exercise_definition_id: int, user_id: str | None = None) -> dict:
        # type: ignore[attr-defined]
        if hasattr(self.repo, "exercise_stats"):
            return self.repo.exercise_stats(exercise_definition_id, user_id)  # type: ignore[misc]
        return {"series": []}

    def muscle_group_weekly_volume(self, muscle_group_id: int, weeks: int = 12, user_id: str | None = None) -> dict:
        if hasattr(self.repo, "muscle_group_weekly_volume"):
            rows = self.repo.muscle_group_weekly_volume(muscle_group_id, weeks, user_id)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def exercise_contribution_last_month(self, muscle_group_id: int, days: int = 30, user_id: str | None = None) -> dict:
        if hasattr(self.repo, "exercise_contribution_last_month"):
            rows = self.repo.exercise_contribution_last_month(muscle_group_id, days, user_id)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def weekly_training_frequency(self, muscle_group_id: int, weeks: int = 12, user_id: str | None = None) -> dict:
        if hasattr(self.repo, "weekly_training_frequency"):
            rows = self.repo.weekly_training_frequency(muscle_group_id, weeks, user_id)  # type: ignore[misc]
            return {"series": rows}
        return {"series": []}

    def exercise_history(self, exercise_definition_id: int, limit: int = 20, user_id: str | None = None) -> dict:
        if hasattr(self.repo, "exercise_history"):
            rows = self.repo.exercise_history(exercise_definition_id, limit, user_id)  # type: ignore[misc]
            return {"items": rows}
        return {"items": []}

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
