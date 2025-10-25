#!/usr/bin/env python3
"""
CLI: Setup helper for Garmin Health migration (new location).
Installs Python requirements and verifies config.env.

Usage:
  python -m app.migrations.cli.setup_migration
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from app.utils import DbConfig, load_env, project_dir


def pip_install(req_path: Path) -> None:
    if not req_path.exists():
        print(f"requirements.txt not found at {req_path}")
        return
    print(f"📦 Installing requirements from {req_path}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(req_path)])


def verify_config() -> bool:
    root = project_dir()
    env_path = root / "config.env"
    if not env_path.exists():
        print("❌ Missing config.env in project root (AI/config.env)")
        print(
            """
Create AI/config.env with your DB settings, e.g.:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=diary
DB_USER=diary_user
DB_PASSWORD=diary123

# Path to your Garmin export (defaults to ./HealthData if not set)
HEALTH_DATA_PATH=./HealthData
"""
        )
        return False
    print(f"✅ Found config.env at {env_path}")
    load_env("config.env")
    cfg = DbConfig()
    print(f"Using DB: host={cfg.host} port={cfg.port} db={cfg.name} user={cfg.user}")
    return True


def main() -> None:
    root = project_dir()
    # Prefer top-level AI/requirements.txt if present, else scripts/requirements.txt
    req = root / "requirements.txt"
    if not req.exists():
        fallback = root / "scripts" / "requirements.txt"
        req = fallback if fallback.exists() else req

    try:
        pip_install(req)
    except subprocess.CalledProcessError as exc:
        print(f"❌ pip install failed: {exc}")
        sys.exit(1)

    if not verify_config():
        sys.exit(1)

    print("\n✅ Setup complete. You can now run: \n   python -m app.migrations.cli.run_migration\n")


if __name__ == "__main__":
    main()
