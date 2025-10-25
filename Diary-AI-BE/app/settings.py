from __future__ import annotations

# pydantic v2 moved BaseSettings to pydantic-settings; keep Field from pydantic
from pydantic import Field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load repo-level env file if present
load_dotenv("config.env")

class Settings(BaseSettings):
    # Server
    port: int = Field(5002, alias="PORT")
    host: str = Field("0.0.0.0", alias="HOST")
    workers: int = Field(2, alias="WORKERS")

    # Analytics
    analytics_concurrency: int = Field(4, alias="ANALYTICS_CONCURRENCY")
    analytics_timeout: float = Field(60.0, alias="ANALYTICS_TIMEOUT")
    analytics_cache_ttl: float = Field(300.0, alias="ANALYTICS_CACHE_TTL")

    # DB pooling
    db_pool_sync: bool = Field(True, alias="DB_POOL_SYNC")
    db_pool_min: int = Field(1, alias="DB_POOL_MIN")
    db_pool_max: int = Field(20, alias="DB_POOL_MAX")

    # pydantic v2: use model_config instead of Config
    model_config = {
        "env_file": "config.env",
        "case_sensitive": False,
        # allow extra envs (db_*, llm_*, etc.) which are read elsewhere in the app
        "extra": "allow",
    }

settings = Settings()  # singleton-like access
