from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from db import get_connection, execute_query

SQL_FILE = Path(__file__).resolve().parents[1] / 'migrations' / 'create_llm_reports_table.sql'


def ensure_table() -> None:
    sql = SQL_FILE.read_text(encoding='utf-8') if SQL_FILE.exists() else None
    if not sql:
        return
    with get_connection() as conn:
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(sql)
            conn.commit()


def upsert_report(day_iso: str, language: str, days_window: int, report: str, raw: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute(
                """
                INSERT INTO ai_llm_daily_reports(day, language, days_window, report, raw_json)
                VALUES (DATE %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (day, language)
                DO UPDATE SET days_window = EXCLUDED.days_window, report = EXCLUDED.report, raw_json = EXCLUDED.raw_json, created_at = NOW()
                RETURNING id, day, language, days_window, report, raw_json, created_at
                """,
                (day_iso, language, int(days_window), report, json.dumps(raw) if raw is not None else None),
            )
            row = cur.fetchone()
            conn.commit()
            if row and isinstance(row, (list, tuple)):
                keys = ["id", "day", "language", "days_window", "report", "raw_json", "created_at"]
                return {k: v for k, v in zip(keys, row)}
            return {}


def get_latest(language: Optional[str] = None) -> Optional[dict[str, Any]]:
    if language:
        row = execute_query(
            "SELECT id, day, language, days_window, report, raw_json, created_at FROM ai_llm_daily_reports WHERE language=%s ORDER BY day DESC LIMIT 1",
            (language,),
            fetch_one=True,
        )
    else:
        row = execute_query(
            "SELECT id, day, language, days_window, report, raw_json, created_at FROM ai_llm_daily_reports ORDER BY day DESC LIMIT 1",
            (),
            fetch_one=True,
        )
    if row and row.get('day') and hasattr(row['day'], 'isoformat'):
        row['day'] = row['day'].isoformat()
    return row

def get_history(limit: int = 10, language: Optional[str] = None) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 10), 100))
    if language:
        rows = execute_query(
            "SELECT id, day, language, days_window, report, raw_json, created_at FROM ai_llm_daily_reports WHERE language=%s ORDER BY day DESC, created_at DESC LIMIT %s",
            (language, limit),
            fetch_all=True,
        )
    else:
        rows = execute_query(
            "SELECT id, day, language, days_window, report, raw_json, created_at FROM ai_llm_daily_reports ORDER BY day DESC, created_at DESC LIMIT %s",
            (limit,),
            fetch_all=True,
        )
    rows = rows or []
    for r in rows:
        if r.get('day') and hasattr(r['day'], 'isoformat'):
            r['day'] = r['day'].isoformat()
    return rows

__all__ = ["ensure_table", "upsert_report", "get_latest", "get_history"]
