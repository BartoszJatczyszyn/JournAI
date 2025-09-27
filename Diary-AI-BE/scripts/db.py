#!/usr/bin/env python3
"""Unified database adapter for Python 3.13.

- Prefers psycopg (v3) with binary wheels for performance and modern API
- Falls back to psycopg2 if psycopg is not available
- Provides get_connection() and execute_query() helpers returning dict rows

Usage:
    from db import get_connection, execute_query

Environment:
    DB_DRIVER=psycopg|psycopg2   # optional; autodetected if unset
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
"""
from __future__ import annotations

from contextlib import contextmanager, suppress
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Mapping
import os

from utils import DbConfig, load_env

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


@contextmanager
def get_connection():  # -> Iterator[Connection]
    """Yield a database connection using the best available driver.

    Caller is responsible for committing (on write) or it will be rolled back.
    """
    cfg = _ConnConfig.from_env()
    conn = _connect_psycopg3(cfg) if _USING_PSYCOPG3 else _connect_psycopg2(cfg)
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass


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
            return None
