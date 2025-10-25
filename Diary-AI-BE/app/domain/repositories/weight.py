from __future__ import annotations
from typing import Protocol, Optional

class IWeightRepository(Protocol):
    def latest(self) -> Optional[dict]:
        ...

    def latest_day_only(self) -> Optional[dict]:
        ...

    def history(self, limit_days: int) -> list[dict]:
        ...

    def recent_joined(self, days: int) -> list[dict]:
        ...
