#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from getpass import getpass
from pathlib import Path
from typing import Any, Dict, Optional

CONFIG_DIR = Path.home() / ".GarminDb"
CONFIG_FILE = CONFIG_DIR / "GarminConnectConfig.json"

DATE_FIELDS = [
    "weight_start_date",
    "sleep_start_date",
    "rhr_start_date",
    "monitoring_start_date",
]


class Log:
    @staticmethod
    def _c(text: str, code: int) -> str:
        return f"\033[{code}m{text}\033[0m"

    @staticmethod
    def info(msg: str) -> None:
        print(Log._c("[INFO] ", 34) + msg)

    @staticmethod
    def warn(msg: str) -> None:
        print(Log._c("[WARN] ", 33) + msg)

    @staticmethod
    def error(msg: str) -> None:
        print(Log._c("[ERROR] ", 31) + msg)

    @staticmethod
    def ok(msg: str) -> None:
        print(Log._c("[OK] ", 32) + msg)


def run_cmd(cmd: list[str], check: bool = True, interactive: bool = False, env: Optional[Dict[str, str]] = None) -> subprocess.CompletedProcess:
    Log.info("Running: " + " ".join(cmd))
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    if interactive:
        run_env.setdefault("PYTHONUNBUFFERED", "1")
        result = subprocess.run(cmd, env=run_env)
    else:
        result = subprocess.run(cmd, capture_output=True, text=True, env=run_env)
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
    if check and result.returncode != 0:
        raise SystemExit(f"Command failed with exit code {result.returncode}")
    return result


def ensure_python_version(min_major: int = 3, min_minor: int = 8) -> None:
    if sys.version_info < (min_major, min_minor):
        Log.error(f"Python >= {min_major}.{min_minor} is required, found {sys.version.split()[0]}")
        raise SystemExit(1)
    Log.ok(f"Python {sys.version.split()[0]} OK")


def install_garmindb(upgrade: bool) -> None:
    try:
        import garmindb  # type: ignore
        present = True
    except ImportError:
        present = False
    if not present:
        Log.info("Installing garmindb package")
        run_cmd([sys.executable, "-m", "pip", "install", "garmindb"])  # noqa: S603
        Log.ok("garmindb installed")
    elif upgrade:
        Log.info("Upgrading garmindb package")
        run_cmd([sys.executable, "-m", "pip", "install", "--upgrade", "garmindb"])  # noqa: S603
        Log.ok("garmindb upgraded")
    else:
        Log.ok("garmindb already available")


def valid_date(date_str: str) -> str:
    try:
        datetime.strptime(date_str, "%m/%d/%Y")
    except ValueError:
        raise argparse.ArgumentTypeError("Date must be MM/DD/YYYY")
    return date_str


def load_existing_config() -> Optional[Dict[str, Any]]:
    try:
        if CONFIG_FILE.exists():
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        Log.warn(f"Failed to read existing config: {exc}")
    return None


def prompt_bool(question: str, default: bool = True) -> bool:
    suf = "[Y/n]" if default else "[y/N]"
    while True:
        ans = input(f"{question} {suf}: ").strip().lower()
        if not ans:
            return default
        if ans in ("y", "yes"):
            return True
        if ans in ("n", "no"):
            return False


def build_config(username: str, unified_start_date: Optional[str], individual_dates: Optional[Dict[str, str]], download_all_activities: int) -> Dict[str, Any]:
    dates: Dict[str, str] = {}
    if unified_start_date:
        for k in DATE_FIELDS:
            dates[k] = unified_start_date
    elif individual_dates:
        dates.update(individual_dates)
    else:
        raise ValueError("Start date(s) required")
    return {
        "db": {"type": "sqlite"},
        "garmin": {"domain": "garmin.com"},
        "credentials": {"user": username, "secure_password": False, "password": None, "password_file": None},
        "data": {**dates, "download_latest_activities": 0, "download_all_activities": download_all_activities},
        "directories": {"relative_to_home": True, "base_dir": "HealthData", "mount_dir": "/Volumes/GARMIN"},
        "enabled_stats": {"monitoring": True, "steps": True, "itime": True, "sleep": True, "rhr": True, "weight": True, "activities": True},
        "course_views": {"steps": []},
        "modes": {},
        "activities": {"display": []},
        "settings": {"metric": True, "default_display_activities": ["walking", "running", "cycling", "strength", "jump rope"]},
        "checkup": {"look_back_days": 90},
    }


def write_password_file(password: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(password + "\n", encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    Log.ok(f"Password file saved: {path}")


def write_config(config: Dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        backup = CONFIG_FILE.with_suffix(".bak")
        CONFIG_FILE.replace(backup)
        Log.info(f"Existing config backed up to {backup}")
    CONFIG_FILE.write_text(json.dumps(config, indent=4), encoding="utf-8")
    Log.ok(f"Config saved: {CONFIG_FILE}")


def run_garmindb(full: bool, latest: bool) -> None:
    if not (full or latest):
        return
    base_args = ["--all", "--download", "--import", "--analyze"]
    if latest:
        base_args.append("--latest")
    Log.info("Starting garmindb data fetch")
    import sysconfig
    from pathlib import Path as _Path

    scripts_dir = sysconfig.get_path("scripts")
    if scripts_dir:
        cli_path = _Path(scripts_dir) / "garmindb_cli.py"
        if cli_path.exists():
            run_cmd([sys.executable, "-u", str(cli_path), *base_args], interactive=True)
            Log.ok("garmindb finished")
            return
    Log.error("Could not locate garmindb CLI in this environment. Is garmindb installed?")
    raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Interactive GarminDb setup")
    p.add_argument("--username")
    p.add_argument("--password", help="Password will be saved to a local password file with chmod 600")
    p.add_argument("--start-date", dest="start_date", type=valid_date, help="Single date MM/DD/YYYY for all start fields")
    p.add_argument("--individual-dates", action="store_true")
    p.add_argument("--download-all-activities", type=int, default=3000)
    p.add_argument("--full", action="store_true")
    p.add_argument("--latest", action="store_true")
    p.add_argument("--upgrade", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    ensure_python_version()
    install_garmindb(args.upgrade)
    existing = load_existing_config()
    if existing:
        Log.info("Existing config found; a new one will be created based on your answers.")
    username = args.username or input("Enter Garmin username (email): ").strip()
    while not username:
        username = input("(Required) Enter Garmin username (email): ").strip()
    password = args.password or getpass("Enter password (will be saved to ~/.GarminDb/password.txt): ")
    unified_start_date: Optional[str] = None
    individual_dates: Optional[Dict[str, str]] = None
    if args.individual_dates:
        individual_dates = {}
        for field in DATE_FIELDS:
            while True:
                v = input(f"Enter {field} (MM/DD/YYYY): ").strip()
                try:
                    individual_dates[field] = valid_date(v)
                    break
                except argparse.ArgumentTypeError as e:
                    print(e)
    else:
        unified_start_date = args.start_date or input("Enter start date (MM/DD/YYYY) for all fields: ").strip()
        while True:
            try:
                unified_start_date = valid_date(unified_start_date)
                break
            except argparse.ArgumentTypeError as e:
                print(e)
                unified_start_date = input("Try again (MM/DD/YYYY): ").strip()
    pw_file = CONFIG_DIR / "password.txt"
    write_password_file(password, pw_file)
    config = build_config(username=username, unified_start_date=unified_start_date, individual_dates=individual_dates, download_all_activities=args.download_all_activities)
    config["credentials"]["password_file"] = str(pw_file)
    write_config(config)
    if args.full or prompt_bool("Run a full import now (--all --download --import --analyze)?", True):
        run_garmindb(full=True, latest=args.latest)
    else:
        Log.info("Skipped initial run. You can run: python -m garmindb --all --download --import --analyze")
    Log.ok("Configuration completed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        Log.warn("Interrupted by user")
