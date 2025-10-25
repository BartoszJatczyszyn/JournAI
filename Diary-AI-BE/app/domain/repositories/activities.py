from __future__ import annotations
from typing import Protocol, Any, List, Tuple

class IActivitiesRepository(Protocol):
    async def fetch_latest(self, where_sql: str, params: Tuple[Any, ...], limit: int) -> List[dict]:
        ...

    async def get_detail(self, activity_id: int) -> dict | None:
        ...

    async def debug_counts(self, days: int) -> Tuple[int, int]:
        ...

    async def debug_sample(self, days: int) -> List[dict]:
        ...

    async def labels(self, days: int) -> List[dict]:
        ...

    async def vo2_count(self, days: int) -> int:
        ...

    async def raw_running_range(self, start_date: str, end_date: str) -> List[dict]:
        ...

    async def count_all(self) -> int:
        ...

    async def count_running_total(self) -> int:
        ...
