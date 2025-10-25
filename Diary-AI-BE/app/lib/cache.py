from __future__ import annotations

import time
from typing import Generic, TypeVar, Callable, Optional

T = TypeVar("T")

class TTLCache(Generic[T]):
    """A minimal in-memory TTL cache.

    - Per-process only (fine for multi-worker uvicorn; each worker has its own cache)
    - KISS: no eviction beyond TTL; keys are simple strings
    - Thread-safe enough for typical FastAPI loads given GIL; for strict safety wrap with a lock.
    """

    def __init__(self, ttl_seconds: float = 300.0) -> None:
        self._ttl = float(ttl_seconds)
        self._store: dict[str, tuple[float, T]] = {}

    def get(self, key: str) -> Optional[T]:
        now = time.time()
        item = self._store.get(key)
        if not item:
            return None
        exp, val = item
        if exp <= now:
            self._store.pop(key, None)
            return None
        return val

    def set(self, key: str, value: T) -> None:
        self._store[key] = (time.time() + self._ttl, value)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()
