from __future__ import annotations
from typing import Protocol, Any, List, Optional, Tuple

class ISleepsRepository(Protocol):
    async def count_in_range(self, where_sql: str, params: Tuple[Any, ...]) -> int:
        ...

    async def fetch_latest(self, where_sql: str, params: Tuple[Any, ...], limit: int, offset: int) -> List[dict]:
        ...

    async def get_by_id(self, sleep_id: int) -> Optional[dict]:
        ...

    async def columns_present(self) -> set[str]:
        ...

    async def insert_returning(self, cols: list[str], params: Tuple[Any, ...]) -> Optional[dict]:
        ...

    async def update_returning(self, sleep_id: int, updates: list[tuple[str, Any]]) -> Optional[dict]:
        ...

    async def exists(self, sleep_id: int) -> bool:
        ...

    async def delete(self, sleep_id: int) -> bool:
        ...

    async def fetch_events_for_day(self, day: str) -> List[dict]:
        ...
