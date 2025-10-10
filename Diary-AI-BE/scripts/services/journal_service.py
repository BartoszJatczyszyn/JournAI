#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict

from db import execute_query, async_execute_query


@dataclass
class JournalService:
    """Service layer for accessing and updating daily_journal entries."""

    def get_entry(self, day: date) -> Dict[str, Any] | None:
        query = "SELECT * FROM daily_journal WHERE day = %s"
        entry = execute_query(query, (day,), fetch_one=True)
        if entry and entry.get("day"):
            try:
                entry["day"] = entry["day"].isoformat()
            except Exception:
                pass
        return entry

    def upsert_entry(self, day: date, data: Dict[str, Any]) -> bool:
        """Upsert entry using ON CONFLICT(day) DO UPDATE with dynamic fields."""
        if not data:
            # Insert empty row to ensure existence
            query = "INSERT INTO daily_journal(day) VALUES(%s) ON CONFLICT(day) DO NOTHING"
            return bool(execute_query(query, (day,), fetch_all=False))

        # Build dynamic upsert
        columns = ["day"] + list(data.keys())
        values = [day] + list(data.values())

        placeholders = ", ".join(["%s"] * len(columns))
        col_list = ", ".join(columns)
        set_clause = ", ".join([f"{k} = EXCLUDED.{k}" for k in data.keys()])

        query = (
            f"INSERT INTO daily_journal ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT(day) DO UPDATE SET {set_clause}"
        )
        return bool(execute_query(query, tuple(values), fetch_all=False))


@dataclass
class AsyncJournalService:
    """Async variant of JournalService using async DB adapter."""

    async def get_entry(self, day: date) -> Dict[str, Any] | None:
        query = "SELECT * FROM daily_journal WHERE day = %s"
        entry = await async_execute_query(query, (day,), fetch_one=True)
        if entry and entry.get("day"):
            try:
                entry["day"] = entry["day"].isoformat()
            except Exception:
                pass
        return entry

    async def upsert_entry(self, day: date, data: Dict[str, Any]) -> bool:
        if not data:
            query = "INSERT INTO daily_journal(day) VALUES(%s) ON CONFLICT(day) DO NOTHING"
            res = await async_execute_query(query, (day,), fetch_all=False)
            return bool(res)
        columns = ["day"] + list(data.keys())
        values = [day] + list(data.values())
        placeholders = ", ".join(["%s"] * len(columns))
        col_list = ", ".join(columns)
        set_clause = ", ".join([f"{k} = EXCLUDED.{k}" for k in data.keys()])
        query = (
            f"INSERT INTO daily_journal ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT(day) DO UPDATE SET {set_clause}"
        )
        res = await async_execute_query(query, tuple(values), fetch_all=False)
        return bool(res)

