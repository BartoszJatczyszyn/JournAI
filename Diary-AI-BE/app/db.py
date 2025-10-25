#!/usr/bin/env python3
from __future__ import annotations

from contextlib import contextmanager, suppress, asynccontextmanager
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Mapping
import os

from app.utils import DbConfig, load_env, get_logger
from typing import Optional

# Detect driver preference
_DEFAULT_DRIVER = os.getenv("DB_DRIVER") or "psycopg"

# Internal flags and types
_USING_PSYCOPG3 = False

# Try import preferred driver first, then fallback
try:
    if _DEFAULT_DRIVER == "psycopg":
        import psycopg  # type: ignore
        from psycopg.rows import dict_row  # type: ignore
        _USING_PSYCOPG3 = True
    else:
        raise ImportError
except Exception:
    try:
        import psycopg  # type: ignore
        from psycopg.rows import dict_row  # type: ignore
        _USING_PSYCOPG3 = True
    except Exception:
        # Fallback to psycopg2
        import psycopg2  # type: ignore
        from psycopg2.extras import RealDictCursor  # type: ignore
        _USING_PSYCOPG3 = False
        if not os.getenv("DB_DRIVER"):
            os.environ["DB_DRIVER"] = "psycopg2"


@dataclass
class _ConnConfig:
    host: str
    port: str
    name: str
    user: str
    password: str

    @classmethod
    def from_env(cls) -> "_ConnConfig":
        load_env("config.env")
        c = DbConfig()
        return cls(host=c.host, port=c.port, name=c.name, user=c.user, password=c.password)


def _connect_psycopg3(cfg: _ConnConfig):  # pragma: no cover - I/O wrapper
    # psycopg3 uses connection objects with context manager support
    return psycopg.connect(  # type: ignore[name-defined]
        host=cfg.host,
        port=cfg.port,
        dbname=cfg.name,
        user=cfg.user,
        password=cfg.password,
        autocommit=False,
    )


def _connect_psycopg2(cfg: _ConnConfig):  # pragma: no cover - I/O wrapper
    return psycopg2.connect(  # type: ignore[name-defined]
        host=cfg.host,
        port=cfg.port,
        database=cfg.name,
        user=cfg.user,
        password=cfg.password,
    )


# ========== Async support (requires psycopg3 + psycopg_pool) ==========
_ASYNC_POOL: Any | None = None
_SYNC_POOL: Any | None = None

if _USING_PSYCOPG3:
    try:
        from psycopg_pool import AsyncConnectionPool, ConnectionPool  # type: ignore
        _ASYNC_POOL_DSN = None  # lazily built from env
    except Exception:  # pragma: no cover - optional dep missing
        AsyncConnectionPool = None  # type: ignore
        ConnectionPool = None  # type: ignore

@asynccontextmanager
async def get_async_connection():
    """Yield an async connection from a global pool.

    If psycopg3 or psycopg_pool are not available, raises RuntimeError.
    """
    if not _USING_PSYCOPG3:
        raise RuntimeError("Async DB not available: psycopg3 not in use")
    try:
        from psycopg_pool import AsyncConnectionPool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("psycopg_pool not installed; run `pip install psycopg[pool]`") from e

    global _ASYNC_POOL
    if _ASYNC_POOL is None:
        cfg = _ConnConfig.from_env()
        conninfo = f"host={cfg.host} port={cfg.port} dbname={cfg.name} user={cfg.user} password={cfg.password}"
        _ASYNC_POOL = AsyncConnectionPool(
            conninfo=conninfo,
            min_size=int(os.getenv("DB_POOL_MIN", "1")),
            max_size=int(os.getenv("DB_POOL_MAX", "20")),
            kwargs={"autocommit": False},
        )
    async with _ASYNC_POOL.connection() as conn:  # type: ignore[union-attr]
        yield conn

async def async_execute_query(
    query: str,
    params: Iterable[Any] | Mapping[str, Any] | None = None,
    *,
    fetch_one: bool = False,
    fetch_all: bool = True,
) -> list[dict[str, Any]] | dict[str, Any] | bool | None:
    if not _USING_PSYCOPG3:
        raise RuntimeError("async_execute_query requires psycopg3")
    from psycopg.rows import dict_row  # type: ignore

    async with get_async_connection() as conn:  # type: ignore
        try:
            async with conn.cursor(row_factory=dict_row) as cur:  # type: ignore[attr-defined]
                await cur.execute(query, params)
                if fetch_one:
                    row = await cur.fetchone()
                    return dict(row) if row is not None else None
                if fetch_all:
                    rows = await cur.fetchall()
                    return [dict(r) for r in rows]
                await conn.commit()
                return True
        except Exception:
            try:
                await conn.rollback()
            except Exception:
                pass
            try:
                LOGGER = get_logger("db")
                LOGGER.exception("DB async query failed: %s | params=%s", query, params)
            except Exception:
                pass
            if os.getenv("DB_DEBUG_RAISE"):
                raise
            if fetch_all:
                return []
            if fetch_one:
                return None
            return False

def _get_sync_pool() -> "ConnectionPool":  # type: ignore[return-type]
    """Lazily create a global psycopg_pool.ConnectionPool for sync usage.

    Only available when using psycopg3. Pool sizes are controlled via env:
    DB_POOL_MIN (default 1), DB_POOL_MAX (default 20). Set DB_POOL_SYNC=0 to disable pooling.
    """
    if not _USING_PSYCOPG3:
        raise RuntimeError("Sync pool not available without psycopg3")
    try:
        from psycopg_pool import ConnectionPool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("psycopg_pool not installed; run `pip install psycopg[pool]`") from e

    global _SYNC_POOL
    if _SYNC_POOL is None:
        cfg = _ConnConfig.from_env()
        conninfo = f"host={cfg.host} port={cfg.port} dbname={cfg.name} user={cfg.user} password={cfg.password}"
        _SYNC_POOL = ConnectionPool(
            conninfo=conninfo,
            min_size=int(os.getenv("DB_POOL_MIN", "1")),
            max_size=int(os.getenv("DB_POOL_MAX", "20")),
            kwargs={"autocommit": False},
        )
    return _SYNC_POOL

@contextmanager
def get_connection():  # -> Iterator["Connection"]
    """Yield a database connection using a global pool when available.

    - If psycopg3 + psycopg_pool is available and DB_POOL_SYNC != '0', use a global ConnectionPool
    - Otherwise, create a one-off connection and close it on exit

    Caller is responsible for committing (on write) or it will be rolled back.
    """
    use_pool = _USING_PSYCOPG3 and os.getenv("DB_POOL_SYNC", "1") not in {"0", "false", "no", "off"}
    if use_pool:
        pool = _get_sync_pool()
        with pool.connection() as conn:  # type: ignore[attr-defined]
            yield conn
        return
    # Fallback: no pool
    cfg = _ConnConfig.from_env()
    conn = _connect_psycopg3(cfg) if _USING_PSYCOPG3 else _connect_psycopg2(cfg)
    try:
        yield conn
    finally:
        with suppress(Exception):
            conn.close()


def execute_query(
    query: str,
    params: Iterable[Any] | Mapping[str, Any] | None = None,
    *,
    fetch_one: bool = False,
    fetch_all: bool = True,
) -> list[dict[str, Any]] | dict[str, Any] | bool | None:
    """Execute a query safely and return dict rows.

    - On fetch_all=True: returns list[dict]
    - On fetch_one=True: returns dict or None
    - On neither: commits and returns True on success
    """
    with get_connection() as conn:  # type: ignore[assignment]
        try:
            if _USING_PSYCOPG3:
                # psycopg3: use row_factory for dict rows
                with conn.cursor(row_factory=dict_row) as cur:  # type: ignore[attr-defined]
                    cur.execute(query, params)
                    if fetch_one:
                        row = cur.fetchone()
                        return dict(row) if row is not None else None
                    if fetch_all:
                        return [dict(r) for r in cur.fetchall()]
                    conn.commit()
                    return True
            else:
                # psycopg2 path
                with conn.cursor(cursor_factory=RealDictCursor) as cur:  # type: ignore[name-defined]
                    cur.execute(query, params)
                    if fetch_one:
                        row = cur.fetchone()
                        return dict(row) if row is not None else None
                    if fetch_all:
                        rows = cur.fetchall()
                        return [dict(r) for r in rows]
                    conn.commit()
                    return True
        except Exception:
            # Rollback on any error for safety
            with suppress(Exception):  # type: ignore[name-defined]
                conn.rollback()
            # Log exception details to help debugging (includes traceback)
            try:
                LOGGER = get_logger("db")
                LOGGER.exception("DB query failed: %s | params=%s", query, params)
            except Exception:
                # Best-effort logging; don't raise from logging failures
                pass
            # In development, allow forcing an exception to surface via env var
            if os.getenv("DB_DEBUG_RAISE"):
                raise
            # Return safe defaults so callers don't receive None unexpectedly
            if fetch_all:
                return []
            if fetch_one:
                return None
            return False
