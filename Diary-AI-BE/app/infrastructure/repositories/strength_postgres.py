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
        # Insert session
        session_row = execute_query(
            """
            INSERT INTO workout_sessions(user_id, started_at, name, notes, duration_minutes)
            VALUES(%s, COALESCE(%s, NOW()), %s, %s, %s)
            RETURNING id, user_id, started_at, name, notes, duration_minutes
            """,
            (
                payload.get("userId"),
                payload.get("startedAt"),
                payload.get("name"),
                payload.get("notes"),
                payload.get("durationMinutes"),
            ),
            fetch_one=True,
            fetch_all=False,
        )
        session_id = session_row["id"]
        # Insert logs + sets
        out_logs: list[dict] = []
        for idx, ex in enumerate(payload.get("exercises", []) or []):
            log_row = execute_query(
                """
                INSERT INTO exercise_logs(workout_session_id, exercise_definition_id, ord, notes)
                VALUES(%s,%s,%s,%s)
                RETURNING id, workout_session_id, exercise_definition_id, ord, notes
                """,
                (
                    session_id,
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

        session_row["exercises"] = out_logs
        return session_row

    def get_workout(self, workout_id: int) -> Optional[dict]:
        self.ensure_tables()
        ws = execute_query("SELECT * FROM workout_sessions WHERE id=%s", (workout_id,), fetch_one=True, fetch_all=False)
        if not ws:
            return None
        logs = execute_query(
            "SELECT * FROM exercise_logs WHERE workout_session_id=%s ORDER BY ord, id",
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
        ws["exercises"] = logs
        # Attach metrics
        sess_metrics = execute_query(
            "SELECT total_session_volume FROM v_workout_session_metrics WHERE workout_session_id=%s",
            (workout_id,),
            fetch_one=True,
            fetch_all=False,
        )
        ws["metrics"] = {"totalVolume": (sess_metrics or {}).get("total_session_volume", 0)}
        return ws

    def list_workouts(self, *, limit: int = 50, offset: int = 0, user_id: str | None = None) -> list[dict]:
        self.ensure_tables()
        if user_id:
            rows = execute_query(
                "SELECT * FROM workout_sessions WHERE user_id=%s ORDER BY started_at DESC LIMIT %s OFFSET %s",
                (user_id, limit, offset),
                fetch_all=True,
            ) or []
        else:
            rows = execute_query(
                "SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
                fetch_all=True,
            ) or []
        return rows

    def delete_workout(self, workout_id: int) -> bool:
        self.ensure_tables()
        res = execute_query("DELETE FROM workout_sessions WHERE id=%s", (workout_id,), fetch_all=False, fetch_one=False)
        return bool(res)

    def last_exercise_log(self, exercise_definition_id: int, user_id: str) -> Optional[dict]:
        self.ensure_tables()
        row = execute_query(
            """
            SELECT el.id AS exercise_log_id, ws.started_at, ws.id AS workout_session_id
            FROM exercise_logs el
            JOIN workout_sessions ws ON ws.id = el.workout_session_id
            WHERE el.exercise_definition_id = %s AND ws.user_id = %s
            ORDER BY ws.started_at DESC
            LIMIT 1
            """,
            (exercise_definition_id, user_id),
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
    def exercise_stats(self, exercise_definition_id: int, user_id: Optional[str] = None) -> dict:
        self.ensure_tables()
        # Best e1RM and total volume per session (date = started_at::date)
        params = [exercise_definition_id]
        user_clause = ""
        if user_id:
            user_clause = " AND ws.user_id = %s"
            params.append(user_id)
        rows = execute_query(
            (
                "SELECT ws.started_at::date AS day, m.best_e1rm, m.total_volume "
                "FROM v_exercise_log_metrics m "
                "JOIN workout_sessions ws ON ws.id = m.workout_session_id "
                "WHERE m.exercise_definition_id = %s" + user_clause + " ORDER BY ws.started_at"
            ),
            tuple(params),
            fetch_all=True,
        ) or []
        return {"series": rows}

    def muscle_group_weekly_volume(self, muscle_group_id: int, weeks: int = 12, user_id: Optional[str] = None) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id, weeks]
        if user_id:
            params.insert(1, user_id)
        sql = (
            """
            SELECT date_trunc('week', ws.started_at)::date AS week,
                   SUM(
                     CASE WHEN e.primary_muscle_group_id = %s THEN m.total_volume
                          WHEN %s = ANY(e.secondary_muscle_group_ids) THEN m.total_volume * 0.3
                          ELSE 0 END
                   ) AS total_volume
            FROM v_exercise_log_metrics m
            JOIN exercise_definitions e ON e.id = m.exercise_definition_id
            JOIN workout_sessions ws ON ws.id = m.workout_session_id
            WHERE ws.started_at >= NOW() - INTERVAL %s
            """
            + (" AND ws.user_id = %s" if user_id else "") +
            """
            GROUP BY 1
            ORDER BY 1
            """
        )
        # Build interval string safely (e.g., '12 weeks')
        interval = f"'{weeks} weeks'"
        # We can't parametrize the interval keyword easily with psycopg; inline safe constructed string
        sql = sql.replace("%s\n            GROUP BY", interval + "\n            GROUP BY", 1)
        return execute_query(sql, tuple(params if user_id else [muscle_group_id, muscle_group_id]), fetch_all=True) or []

    def exercise_contribution_last_month(self, muscle_group_id: int, days: int = 30, user_id: Optional[str] = None) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id]
        if user_id:
            params.append(user_id)
        sql = (
            """
            WITH vols AS (
              SELECT e.id AS exercise_id, e.name,
                     SUM(CASE WHEN e.primary_muscle_group_id = %s THEN m.total_volume ELSE 0 END)
                     + SUM(CASE WHEN %s = ANY(e.secondary_muscle_group_ids) THEN m.total_volume * 0.3 ELSE 0 END) AS volume
              FROM v_exercise_log_metrics m
              JOIN exercise_definitions e ON e.id = m.exercise_definition_id
              JOIN workout_sessions ws ON ws.id = m.workout_session_id
              WHERE ws.started_at >= NOW() - INTERVAL %s
        """
            + (" AND ws.user_id = %s" if user_id else "") +
            """
              GROUP BY e.id, e.name
            )
            SELECT * FROM vols WHERE volume > 0 ORDER BY volume DESC LIMIT 100
            """
        )
        interval = f"'{days} days'"
        sql = sql.replace("%s\n              GROUP", interval + "\n              GROUP", 1)
        return execute_query(sql, tuple(params if user_id else [muscle_group_id]), fetch_all=True) or []

    def weekly_training_frequency(self, muscle_group_id: int, weeks: int = 12, user_id: Optional[str] = None) -> list[dict]:
        self.ensure_tables()
        params = [muscle_group_id]
        if user_id:
            params.append(user_id)
        sql = (
            """
            SELECT date_trunc('week', ws.started_at)::date AS week,
                   COUNT(DISTINCT ws.id) AS sessions
            FROM workout_sessions ws
            WHERE ws.started_at >= NOW() - INTERVAL %s
        """
            + (" AND ws.user_id = %s" if user_id else "") +
            """
            AND EXISTS (
              SELECT 1
              FROM exercise_logs el
              JOIN exercise_definitions e ON e.id = el.exercise_definition_id
              WHERE el.workout_session_id = ws.id
                AND (e.primary_muscle_group_id = %s OR %s = ANY(e.secondary_muscle_group_ids))
            )
            GROUP BY 1
            ORDER BY 1
            """
        )
        interval = f"'{weeks} weeks'"
        sql = sql.replace("%s\n            AND EXISTS", interval + "\n            AND EXISTS", 1)
        # parameters order: [muscle_group_id] + [user_id?] + [muscle_group_id, muscle_group_id]
        final_params = []
        if user_id:
            final_params = [muscle_group_id, user_id, muscle_group_id, muscle_group_id]
        else:
            final_params = [muscle_group_id, muscle_group_id]
        return execute_query(sql, tuple(final_params), fetch_all=True) or []

    def exercise_history(self, exercise_definition_id: int, limit: int = 20, user_id: Optional[str] = None) -> list[dict]:
        self.ensure_tables()
        params = [exercise_definition_id]
        if user_id:
            params.append(user_id)
        rows = execute_query(
            (
                "SELECT el.id AS exercise_log_id, ws.id AS workout_session_id, ws.started_at::date AS day "
                "FROM exercise_logs el JOIN workout_sessions ws ON ws.id = el.workout_session_id "
                "WHERE el.exercise_definition_id = %s"
                + (" AND ws.user_id = %s" if user_id else "") +
                " ORDER BY ws.started_at DESC LIMIT %s"
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
