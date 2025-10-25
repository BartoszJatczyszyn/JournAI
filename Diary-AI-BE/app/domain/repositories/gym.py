from __future__ import annotations
from typing import Protocol

class IGymRepository(Protocol):
    def ensure_table(self) -> None:
        ...

    def load_bucket(self, key: str) -> list:
        ...

    def save_bucket(self, key: str, payload: list) -> None:
        ...
