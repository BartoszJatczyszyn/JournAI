from __future__ import annotations
from typing import Optional, Sequence

from app.db import execute_query
from domain.repositories.strength import IStrengthRepository


INIT_SQL = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;
"""


class PostgresStrengthRepository(IStrengthRepository):
    def ensure_tables(self) -> None:
        # Ensure extensions and base tables (tables are created by SQL file; this is safe idempotent extra)
        execute_query(INIT_SQL)

    # ------------- Muscle groups -------------
    def list_muscle_groups(self) -> list[dict]:
        self.ensure_tables()
        return execute_query("SELECT id, name, description FROM muscle_groups ORDER BY id", fetch_all=True) or []

    def upsert_muscle_groups(self, groups: Sequence[dict]) -> None:
        self.ensure_tables()
        for g in groups:
            execute_query(
                """
                INSERT INTO muscle_groups(name, description)
                VALUES(%s, %s)
                ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description
                """,
                (g.get("name"), g.get("description")),
                fetch_all=False,
                fetch_one=False,
            )

    # ------------- Exercises -------------
    def list_exercises(self) -> list[dict]:
        self.ensure_tables()
        return execute_query(
            """
            SELECT e.id, e.name, e.primary_muscle_group_id, e.secondary_muscle_group_ids,
                   e.equipment_type, e.exercise_type, e.description,
                   mg.name AS primary_muscle_group
            FROM exercise_definitions e
            JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
            ORDER BY e.name
            """,
            fetch_all=True,
        ) or []

    def get_exercise(self, exercise_id: int) -> Optional[dict]:
        self.ensure_tables()
        return execute_query(
            """
            SELECT e.* FROM exercise_definitions e WHERE e.id = %s
            """,
            (exercise_id,),
            fetch_one=True,
            fetch_all=False,
        )

    def search_exercises(self, *, query: str | None, muscle_group_id: int | None) -> list[dict]:
        self.ensure_tables()
        q = query or ""
        mg = muscle_group_id
        params: list = []
        where: list[str] = []
        if q:
            where.append("(e.name ILIKE %s OR e.name %s %s)")
            # fallback plain ilike; pg_trgm similarity operator %
            params.extend([f"%{q}%", "%", q])
        if mg is not None:
            where.append("(e.primary_muscle_group_id = %s OR %s = ANY(e.secondary_muscle_group_ids))")
            params.extend([mg, mg])
        sql = (
            "SELECT e.id, e.name, e.primary_muscle_group_id, e.secondary_muscle_group_ids, e.equipment_type, e.exercise_type, e.description "
            "FROM exercise_definitions e "
        )
        if where:
            sql += "WHERE " + " AND ".join(where) + " "
        sql += "ORDER BY e.name LIMIT 100"
        return execute_query(sql, tuple(params) if params else None, fetch_all=True) or []

    def upsert_exercises(self, exercises: Sequence[dict]) -> None:
        self.ensure_tables()
        for ex in exercises:
            execute_query(
                """
                INSERT INTO exercise_definitions(name, primary_muscle_group_id, secondary_muscle_group_ids, equipment_type, exercise_type, description)
                VALUES(%s,%s,%s,%s,%s,%s)
                ON CONFLICT (name) DO UPDATE SET
                    primary_muscle_group_id = EXCLUDED.primary_muscle_group_id,
                    secondary_muscle_group_ids = EXCLUDED.secondary_muscle_group_ids,
                    equipment_type = EXCLUDED.equipment_type,
                    exercise_type = EXCLUDED.exercise_type,
                    description = EXCLUDED.description
                """,
                (
                    ex.get("name"),
                    ex.get("primary_muscle_group_id"),
                    ex.get("secondary_muscle_group_ids") or [],
                    ex.get("equipment_type"),
                    ex.get("exercise_type"),
                    ex.get("description"),
                ),
                fetch_all=False,
                fetch_one=False,
            )

    # ------------- Workouts -------------
    def create_workout(self, payload: dict) -> dict:
        self.ensure_tables()
        activity_id = payload.get("activityId")
        if not activity_id:
            raise ValueError("activityId is required to attach strength logs to a Garmin activity")
        # verify activity exists and is strength_training
        a = execute_query(
            "SELECT activity_id, start_time, name, sub_sport FROM garmin_activities WHERE activity_id=%s",
            (activity_id,),
            fetch_one=True,
            fetch_all=False,
        )
        if not a:
            raise ValueError("Garmin activity not found")
        # Insert logs + sets linked to garmin activity
        out_logs: list[dict] = []
        for idx, ex in enumerate(payload.get("exercises", []) or []):
            log_row = execute_query(
                """
                INSERT INTO exercise_logs(garmin_activity_id, exercise_definition_id, ord, notes)
                VALUES(%s,%s,%s,%s)
                RETURNING id, garmin_activity_id, exercise_definition_id, ord, notes
                """,
                (
                    activity_id,
                    ex.get("exerciseDefinitionId"),
                    ex.get("order") or (idx + 1),
                    ex.get("notes"),
                ),
                fetch_one=True,
                fetch_all=False,
            )
            log_id = log_row["id"]
            out_sets: list[dict] = []
            for s in ex.get("sets", []) or []:
                set_row = execute_query(
                    """
                    INSERT INTO exercise_sets(exercise_log_id, set_number, reps, weight, rpe, is_warmup)
                    VALUES(%s,%s,%s,%s,%s,%s)
                    RETURNING id, exercise_log_id, set_number, reps, weight, rpe, is_warmup
                    """,
                    (
                        log_id,
                        s.get("setNumber"),
                        s.get("reps"),
                        s.get("weight"),
                        s.get("rpe"),
                        bool(s.get("isWarmup", False)),
                    ),
                    fetch_one=True,
                    fetch_all=False,
                )
                out_sets.append(set_row)
            log_row["sets"] = out_sets
            out_logs.append(log_row)

        return {"activity_id": activity_id, "start_time": a.get("start_time"), "name": a.get("name"), "sub_sport": a.get("sub_sport"), "exercises": out_logs}

    def get_workout(self, workout_id: int) -> Optional[dict]:
        self.ensure_tables()
        # Treat workout_id as garmin activity id
        a = execute_query(
            "SELECT activity_id, start_time, name, sub_sport FROM garmin_activities WHERE activity_id=%s",
            (workout_id,),
            fetch_one=True,
            fetch_all=False,
        )
        if not a:
            return None
        logs = execute_query(
            "SELECT * FROM exercise_logs WHERE garmin_activity_id=%s ORDER BY ord, id",
            (workout_id,),
            fetch_all=True,
        ) or []
        for log in logs:
            sets = execute_query(
                "SELECT * FROM exercise_sets WHERE exercise_log_id=%s ORDER BY set_number",
                (log["id"],),
                fetch_all=True,
            ) or []
            log["sets"] = sets
        out = {"id": a.get("activity_id"), "start_time": a.get("start_time"), "name": a.get("name"), "sub_sport": a.get("sub_sport"), "exercises": logs}
        # Attach metrics based on activity
        am = execute_query(
            "SELECT total_activity_volume FROM v_strength_activity_metrics WHERE garmin_activity_id=%s",
            (workout_id,),
            fetch_one=True,
            fetch_all=False,
        )
        out["metrics"] = {"totalVolume": (am or {}).get("total_activity_volume", 0)}
        return out

    def list_workouts(self, *, limit: int = 50, offset: int = 0) -> list[dict]:
        self.ensure_tables()
        params: list = []
        where = ["LOWER(COALESCE(sub_sport,'')) = 'strength_training'"]
        sql = (
            "SELECT activity_id AS id, start_time, name, sub_sport FROM garmin_activities "
            + ("WHERE " + " AND ".join(where) if where else "") +
            " ORDER BY start_time DESC LIMIT %s OFFSET %s"
        )
        params.extend([limit, offset])
        return execute_query(sql, tuple(params), fetch_all=True) or []

    def update_workout(self, workout_id: int, payload: dict) -> dict:
        self.ensure_tables()
        # Replace logs and sets for the garmin activity
        execute_query("DELETE FROM exercise_sets WHERE exercise_log_id IN (SELECT id FROM exercise_logs WHERE garmin_activity_id=%s)", (workout_id,), fetch_all=False, fetch_one=False)
        execute_query("DELETE FROM exercise_logs WHERE garmin_activity_id=%s", (workout_id,), fetch_all=False, fetch_one=False)

        out_logs: list[dict] = []
        for idx, ex in enumerate(payload.get("exercises", []) or []):
            log_row = execute_query(
                """
                INSERT INTO exercise_logs(garmin_activity_id, exercise_definition_id, ord, notes)
                VALUES(%s,%s,%s,%s)
                RETURNING id, garmin_activity_id, exercise_definition_id, ord, notes
                """,
                (
                    workout_id,
                    ex.get("exerciseDefinitionId"),
                    ex.get("order") or (idx + 1),
                    ex.get("notes"),
                ),
                fetch_one=True,
                fetch_all=False,
            )
            log_id = log_row["id"]
            out_sets: list[dict] = []
            for s in ex.get("sets", []) or []:
                set_row = execute_query(
                    """
                    INSERT INTO exercise_sets(exercise_log_id, set_number, reps, weight, rpe, is_warmup)
                    VALUES(%s,%s,%s,%s,%s,%s)
                    RETURNING id, exercise_log_id, set_number, reps, weight, rpe, is_warmup
                    """,
                    (
                        log_id,
                        s.get("setNumber"),
                        s.get("reps"),
                        s.get("weight"),
                        s.get("rpe"),
                        bool(s.get("isWarmup", False)),
                    ),
                    fetch_one=True,
                    fetch_all=False,
                )
                out_sets.append(set_row)
            log_row["sets"] = out_sets
            out_logs.append(log_row)

        session = self.get_workout(workout_id) or {}
        if session:
            session["exercises"] = out_logs
        return session

    def delete_workout(self, workout_id: int) -> bool:
        self.ensure_tables()
        # Only delete attached strength logs; do not delete garmin activity
        execute_query("DELETE FROM exercise_sets WHERE exercise_log_id IN (SELECT id FROM exercise_logs WHERE garmin_activity_id=%s)", (workout_id,), fetch_all=False, fetch_one=False)
        execute_query("DELETE FROM exercise_logs WHERE garmin_activity_id=%s", (workout_id,), fetch_all=False, fetch_one=False)
        return True

    def last_exercise_log(self, exercise_definition_id: int) -> Optional[dict]:
        self.ensure_tables()
        params = [exercise_definition_id]
        row = execute_query(
            (
                "SELECT el.id AS exercise_log_id, ga.start_time, ga.activity_id AS garmin_activity_id\n"
                "FROM exercise_logs el\n"
                "JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id\n"
                "WHERE el.exercise_definition_id = %s AND LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training'"
                " ORDER BY ga.start_time DESC LIMIT 1"
            ),
            tuple(params),
            fetch_one=True,
            fetch_all=False,
        )
        if not row:
            return None
        sets = execute_query(
            "SELECT set_number, reps, weight, rpe, is_warmup FROM exercise_sets WHERE exercise_log_id=%s ORDER BY set_number",
            (row["exercise_log_id"],),
            fetch_all=True,
        ) or []
        row["sets"] = sets
        return row

    # Additional convenience not in protocol: simple exercise stats
    def exercise_stats(self, exercise_definition_id: int) -> dict:
        self.ensure_tables()
        # Best e1RM and total volume per activity day
        params: list = [exercise_definition_id]
        rows = execute_query(
            (
                "SELECT COALESCE(ga.start_time, NOW())::date AS day, m.best_e1rm, m.total_volume "
                "FROM v_exercise_log_metrics m "
                "JOIN exercise_logs el ON el.id = m.exercise_log_id "
                "JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id "
                "WHERE m.exercise_definition_id = %s ORDER BY ga.start_time"
            ),
            tuple(params),
            fetch_all=True,
        ) or []
        return {"series": rows}

    def muscle_group_weekly_volume(self, muscle_group_id: int, weeks: int = 12) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id, weeks]
        sql = (
            """
            SELECT date_trunc('week', ga.start_time)::date AS week,
                   SUM(
                     CASE WHEN e.primary_muscle_group_id = %s THEN m.total_volume
                          WHEN %s = ANY(e.secondary_muscle_group_ids) THEN m.total_volume * 0.3
                          ELSE 0 END
                   ) AS total_volume
            FROM v_exercise_log_metrics m
            JOIN exercise_definitions e ON e.id = m.exercise_definition_id
            JOIN exercise_logs el ON el.id = m.exercise_log_id
            JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id
            WHERE ga.start_time >= NOW() - INTERVAL %s AND LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training'
            GROUP BY 1
            ORDER BY 1
            """
        )
        interval = f"'{weeks} weeks'"
        sql = sql.replace("%s\n            GROUP BY", interval + "\n            GROUP BY", 1)
        return execute_query(sql, tuple([muscle_group_id, muscle_group_id]), fetch_all=True) or []

    def exercise_contribution_last_month(self, muscle_group_id: int, days: int = 30) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id]
        sql = (
            """
            WITH vols AS (
              SELECT e.id AS exercise_id, e.name,
                     SUM(CASE WHEN e.primary_muscle_group_id = %s THEN m.total_volume ELSE 0 END)
                     + SUM(CASE WHEN %s = ANY(e.secondary_muscle_group_ids) THEN m.total_volume * 0.3 ELSE 0 END) AS volume
              FROM v_exercise_log_metrics m
              JOIN exercise_definitions e ON e.id = m.exercise_definition_id
              JOIN exercise_logs el ON el.id = m.exercise_log_id
              JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id
              WHERE ga.start_time >= NOW() - INTERVAL %s AND LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training'
              GROUP BY e.id, e.name
            )
            SELECT * FROM vols WHERE volume > 0 ORDER BY volume DESC LIMIT 100
            """
        )
        interval = f"'{days} days'"
        sql = sql.replace("%s\n              GROUP", interval + "\n              GROUP", 1)
        return execute_query(sql, tuple([muscle_group_id]), fetch_all=True) or []

    def weekly_training_frequency(self, muscle_group_id: int, weeks: int = 12) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id]
        sql = (
            """
            SELECT date_trunc('week', ga.start_time)::date AS week,
                   COUNT(DISTINCT ga.activity_id) AS sessions
            FROM garmin_activities ga
            WHERE ga.start_time >= NOW() - INTERVAL %s AND LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training'
            AND EXISTS (
              SELECT 1
              FROM exercise_logs el
              JOIN exercise_definitions e ON e.id = el.exercise_definition_id
              WHERE el.garmin_activity_id = ga.activity_id
                AND (e.primary_muscle_group_id = %s OR %s = ANY(e.secondary_muscle_group_ids))
            )
            GROUP BY 1
            ORDER BY 1
            """
        )
        interval = f"'{weeks} weeks'"
        sql = sql.replace("%s\n            AND EXISTS", interval + "\n            AND EXISTS", 1)
        final_params = [muscle_group_id, muscle_group_id]
        return execute_query(sql, tuple(final_params), fetch_all=True) or []

    def exercise_history(self, exercise_definition_id: int, limit: int = 20) -> list[dict]:
        self.ensure_tables()
        params = [exercise_definition_id]
        rows = execute_query(
            (
                "SELECT el.id AS exercise_log_id, ga.activity_id AS garmin_activity_id, ga.start_time::date AS day "
                "FROM exercise_logs el JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id "
                "WHERE el.exercise_definition_id = %s ORDER BY ga.start_time DESC LIMIT %s"
            ),
            tuple(params + [limit]),
            fetch_all=True,
        ) or []
        # Fetch sets per log
        for r in rows:
            r["sets"] = execute_query(
                "SELECT set_number, reps, weight, rpe, is_warmup FROM exercise_sets WHERE exercise_log_id=%s ORDER BY set_number",
                (r["exercise_log_id"],),
                fetch_all=True,
            ) or []
        return rows

    # -------- Analytics series --------
    def exercise_e1rm_progress(self, exercise_definition_id: int) -> list[dict]:
        self.ensure_tables()
        params: list = [exercise_definition_id]
        sql = (
            "SELECT ga.start_time::date AS day, MAX(m.best_e1rm) AS best_e1rm "
            "FROM v_exercise_log_metrics m \n"
            "JOIN exercise_logs el ON el.id = m.exercise_log_id \n"
            "JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id \n"
            "WHERE m.exercise_definition_id = %s GROUP BY 1 ORDER BY 1"
        )
        return execute_query(sql, tuple(params), fetch_all=True) or []

    def workouts_volume_series(self, days: int = 90) -> list[dict]:
        self.ensure_tables()
        params: list = []
        sql = (
            """
            SELECT ga.start_time::date AS day, COALESCE(v.total_activity_volume, 0) AS total_volume
            FROM garmin_activities ga LEFT JOIN v_strength_activity_metrics v ON v.garmin_activity_id = ga.activity_id
            WHERE LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training' AND ga.start_time >= NOW() - INTERVAL %s
            ORDER BY day
            """
        )
        interval = f"'{days} days'"
        sql = sql.replace("%s\n            ORDER BY", interval + "\n            ORDER BY", 1)
        return execute_query(sql, None, fetch_all=True) or []

    def all_exercises_e1rm_progress(self, days: int = 180) -> list[dict]:
        self.ensure_tables()
        params: list = []
        sql = (
            """
            SELECT m.exercise_definition_id, ga.start_time::date AS day, MAX(m.best_e1rm) AS best_e1rm
            FROM v_exercise_log_metrics m
            JOIN exercise_logs el ON el.id = m.exercise_log_id
            JOIN garmin_activities ga ON ga.activity_id = el.garmin_activity_id
            WHERE ga.start_time >= NOW() - INTERVAL %s AND LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training'
            GROUP BY m.exercise_definition_id, day
            ORDER BY m.exercise_definition_id, day
            """
        )
        interval = f"'{days} days'"
        sql = sql.replace("%s\n            GROUP BY", interval + "\n            GROUP BY", 1)
        return execute_query(sql, None, fetch_all=True) or []

    # Not in protocol: counts per day to support correlations
    def daily_strength_counts(self, days: int = 90) -> list[dict]:
        self.ensure_tables()
        params: list = []
        sql = (
            """
            SELECT ga.start_time::date AS day,
                   COUNT(DISTINCT el.id) AS logs_count,
                   COUNT(es.id) AS sets_count
            FROM garmin_activities ga
            LEFT JOIN exercise_logs el ON el.garmin_activity_id = ga.activity_id
            LEFT JOIN exercise_sets es ON es.exercise_log_id = el.id
            WHERE LOWER(COALESCE(ga.sub_sport,'')) = 'strength_training' AND ga.start_time >= NOW() - INTERVAL %s
            GROUP BY 1
            ORDER BY 1
            """
        )
        interval = f"'{days} days'"
        sql = sql.replace("%s\n            GROUP BY", interval + "\n            GROUP BY", 1)
        return execute_query(sql, None, fetch_all=True) or []

    # Templates using gym_store bucket as generic JSON storage
    def list_templates(self) -> list[dict]:
        return execute_query("SELECT payload FROM gym_store WHERE key='strength_templates'", fetch_one=True) or {"payload": []}["payload"]

    def upsert_template(self, tpl: dict) -> dict:
        existing = self.list_templates()
        filtered = [t for t in existing if t.get("id") != tpl.get("id")]
        filtered.append(tpl)
        execute_query(
            """
            INSERT INTO gym_store(key, payload, updated_at) VALUES('strength_templates', %s, NOW())
            ON CONFLICT (key) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()
            """,
            (filtered,),
            fetch_all=False,
            fetch_one=False,
        )
        return tpl

    def delete_template(self, tpl_id: str) -> bool:
        existing = self.list_templates()
        filtered = [t for t in existing if t.get("id") != tpl_id]
        if len(filtered) == len(existing):
            return False
        execute_query(
            """
            INSERT INTO gym_store(key, payload, updated_at) VALUES('strength_templates', %s, NOW())
            ON CONFLICT (key) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()
            """,
            (filtered,),
            fetch_all=False,
            fetch_one=False,
        )
        return True

__all__ = ["PostgresStrengthRepository"]
