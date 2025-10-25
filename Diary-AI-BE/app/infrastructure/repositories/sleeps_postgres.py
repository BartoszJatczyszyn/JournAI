from __future__ import annotations
from typing import Any, List, Optional, Tuple
from app.db import async_execute_query
from domain.repositories.sleeps import ISleepsRepository

class PostgresSleepsRepository(ISleepsRepository):
    async def count_in_range(self, where_sql: str, params: Tuple[Any, ...]) -> int:
        q = f"SELECT COUNT(*) as total_count FROM garmin_sleep_sessions WHERE {where_sql}"
        row = await async_execute_query(q, params, fetch_one=True) or {"total_count": 0}
        return int(row.get("total_count") or 0)

    async def fetch_latest(self, where_sql: str, params: Tuple[Any, ...], limit: int, offset: int) -> List[dict]:
        q = f"""
        SELECT * FROM garmin_sleep_sessions
        WHERE {where_sql}
        ORDER BY sleep_start DESC
        LIMIT %s OFFSET %s
        """
        rows = await async_execute_query(q, (*params, limit, offset)) or []
        return [dict(r) for r in rows]

    async def get_by_id(self, sleep_id: int) -> Optional[dict]:
        q = "SELECT * FROM garmin_sleep_sessions WHERE sleep_id = %s"
        row = await async_execute_query(q, (sleep_id,), fetch_one=True)
        return dict(row) if row else None

    async def columns_present(self) -> set[str]:
        rows = await async_execute_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_sleep_sessions'",
            None,
            fetch_all=True,
        ) or []
        return {r.get('column_name') for r in rows if isinstance(r, dict)}

    async def insert_returning(self, cols: list[str], params: Tuple[Any, ...]) -> Optional[dict]:
        placeholders = ', '.join(['%s'] * len(cols))
        q = f"INSERT INTO garmin_sleep_sessions ({', '.join(cols)}) VALUES ({placeholders}) RETURNING *"
        row = await async_execute_query(q, params, fetch_one=True)
        return dict(row) if row else None

    async def update_returning(self, sleep_id: int, updates: list[tuple[str, Any]]) -> Optional[dict]:
        set_sql = ', '.join([f"{c} = %s" for c, _ in updates])
        params = tuple(val for _, val in updates) + (sleep_id,)
        q = f"UPDATE garmin_sleep_sessions SET {set_sql} WHERE sleep_id = %s RETURNING *"
        row = await async_execute_query(q, params, fetch_one=True)
        return dict(row) if row else None

    async def exists(self, sleep_id: int) -> bool:
        row = await async_execute_query("SELECT sleep_id FROM garmin_sleep_sessions WHERE sleep_id = %s", (sleep_id,), fetch_one=True)
        return bool(row)

    async def delete(self, sleep_id: int) -> bool:
        await async_execute_query("DELETE FROM garmin_sleep_sessions WHERE sleep_id = %s", (sleep_id,))
        return True

    async def fetch_events_for_day(self, day: str) -> List[dict]:
        # garmin_sleep_events schema uses `timestamp`, `event`, `duration`.
        # Query by date(timestamp) to match provided day string (YYYY-MM-DD).
        q = """
        SELECT timestamp, event, duration
        FROM garmin_sleep_events
        WHERE date(timestamp) = %s
        ORDER BY timestamp
        """
        rows = await async_execute_query(q, (day,)) or []
        return [dict(r) for r in rows]
