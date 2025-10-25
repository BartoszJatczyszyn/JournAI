from __future__ import annotations
from app.db import execute_query
from domain.repositories.gym import IGymRepository

INIT_SQL = """
CREATE TABLE IF NOT EXISTS gym_store (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""

class PostgresGymRepository(IGymRepository):
    def ensure_table(self) -> None:
        execute_query(INIT_SQL)

    def load_bucket(self, key: str) -> list:
        self.ensure_table()
        row = execute_query("SELECT payload FROM gym_store WHERE key=%s", (key,), fetch_one=True)
        return row['payload'] if row and row['payload'] else []

    def save_bucket(self, key: str, payload: list) -> None:
        self.ensure_table()
        execute_query(
            """
            INSERT INTO gym_store(key,payload,updated_at) VALUES(%s,%s,NOW())
            ON CONFLICT (key) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()
            """,
            (key, payload),
        )
