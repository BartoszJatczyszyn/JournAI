#!/usr/bin/env python3
"""Utility helpers shared across scripts.

Follows PEP 8 and embraces the Zen of Python: simple, explicit, readable.
"""
from __future__ import annotations

from dataclasses import dataclass
import logging
import os
from pathlib import Path

# Optional dependency: python-dotenv
try:
    from dotenv import load_dotenv as _load_dotenv  # type: ignore
except Exception:  # pragma: no cover
    def _load_dotenv(*_args, **_kwargs):
        return None  # noop if dotenv not available


_DEFAULT_LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def setup_logging(verbose: bool = False) -> None:
    """Configure root logging.

    Parameters
    - verbose: When True, sets logging level to DEBUG; otherwise INFO.
    """
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format=_DEFAULT_LOG_FORMAT)


def get_logger(name: str | None = None) -> logging.Logger:
    """Return a logger for a given module or a default one."""
    return logging.getLogger(name if name else __name__)


def scripts_dir() -> Path:
    """Return the scripts directory (this file's parent)."""
    return Path(__file__).resolve().parent


def project_dir() -> Path:
    """Return the project root directory (parent of scripts)."""
    return scripts_dir().parent


def load_env(filename: str = "config.env") -> Path:
    """Load environment variables from project root filename.

    Returns the resolved path to the env file (whether it existed or not).
    """
    env_path = project_dir() / filename
    if env_path.exists():
        _load_dotenv(env_path)
    return env_path


def require_file(path: Path, message: str | None = None) -> Path:
    """Ensure a file exists, raising RuntimeError if not."""
    if not path.exists():
        msg = message or f"Required file not found: {path}"
        raise RuntimeError(msg)
    return path


@dataclass
class DbConfig:
    host: str = os.getenv("DB_HOST", "localhost")
    port: str = os.getenv("DB_PORT", "5432")
    name: str = os.getenv("DB_NAME", "diary")
    user: str = os.getenv("DB_USER", "diary_user")
    password: str = os.getenv("DB_PASSWORD", "diary123")

    def dsn(self) -> str:
        return (
            f"host={self.host} port={self.port} dbname={self.name} "
            f"user={self.user} password={self.password}"
        )
