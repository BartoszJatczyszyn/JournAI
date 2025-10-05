#!/usr/bin/env python3
"""Interactive setup script for GarminDb.

Functionality:
1. Checks Python version.
2. Installs/updates the garmindb package (optionally with the --upgrade flag).
3. Creates the ~/.GarminDb directory if it does not exist.
4. Creates/updates the GarminConnectConfig.json file by interactively asking for:
   - username
   - password (hidden)
   - start date (use one date for several fields) or separate dates if the user chooses
5. Optionally allows saving the password in a separate file (password_file) instead of storing it directly in JSON.
6. Optionally runs: full fetch (--all --download --import --analyze) or only the latest (--latest).

Security:
- Password is NOT displayed.
- If you choose password_file we set secure_password=false (as in the example) and point to its path.
- The password file will be chmod 600.

Usage:
    python scripts/setup_garmindb.py

You can also pass arguments to skip interaction:
    python scripts/setup_garmindb.py \
        --username me@example.com \
        --start-date 11/01/2024 \
        --latest

See --help for the full list.
"""
from __future__ import annotations
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from getpass import getpass
from pathlib import Path
from typing import Any, Dict

CONFIG_DIR = Path.home() / ".GarminDb"
CONFIG_FILE = CONFIG_DIR / "GarminConnectConfig.json"
DEFAULT_PASSWORD_FILE = CONFIG_DIR / "password.txt"

DATE_FIELDS = [
    "weight_start_date",
    "sleep_start_date",
    "rhr_start_date",
    "monitoring_start_date",
]


def color(txt: str, code: str) -> str:
    return f"\033[{code}m{txt}\033[0m"


def info(msg: str):
    print(color("[INFO] ", "34") + msg)


def warn(msg: str):
    print(color("[WARN] ", "33") + msg)


def error(msg: str):
    print(color("[ERROR] ", "31") + msg)


def success(msg: str):
    print(color("[OK] ", "32") + msg)


def run_cmd(cmd: list[str], check: bool = True):
    info("Running: " + " ".join(cmd))
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout)
    if check and result.returncode != 0:
        raise SystemExit(f"Polecenie nie powiodło się (exit {result.returncode})")
    return result


def ensure_python_version(min_major=3, min_minor=8):
    if sys.version_info < (min_major, min_minor):
        error(f"Required version >= {min_major}.{min_minor}, detected {sys.version.split()[0]}")
        raise SystemExit(1)
    success(f"Python {sys.version.split()[0]} OK")


def install_garmindb(upgrade: bool):
    try:
        import garmindb  # noqa: F401
        installed = True
    except ImportError:
        installed = False

    if not installed:
        info("garmindb package is not installed. Installing...")
        run_cmd([sys.executable, "-m", "pip", "install", "garmindb"]) 
        success("garmindb installed")
    else:
        success("garmindb already installed")
        if upgrade:
            info("Upgrading garmindb to the latest version...")
            run_cmd([sys.executable, "-m", "pip", "install", "--upgrade", "garmindb"]) 
            success("garmindb upgraded")


def valid_date(date_str: str) -> str:
    try:
        datetime.strptime(date_str, "%m/%d/%Y")
    except ValueError:
        raise argparse.ArgumentTypeError("Date must be in format MM/DD/YYYY (e.g., 11/01/2024)")
    return date_str


def load_existing_config() -> Dict[str, Any] | None:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            warn(f"Failed to load existing configuration: {e}")
    return None


def prompt_bool(question: str, default: bool = True) -> bool:
    suf = "[Y/n]" if default else "[y/N]"
    while True:
        ans = input(f"{question} {suf}: ").strip().lower()
        if not ans:
            return default
        if ans in ("y", "yes", "t", "true"):
            return True
        if ans in ("n", "no", "f", "false"):
            return False
        print("Please answer y or n.")


def build_config(
    username: str,
    password: str | None,
    unified_start_date: str | None,
    individual_dates: Dict[str, str] | None,
    use_password_file: bool,
    password_file: Path | None,
    download_latest_activities: int,
    download_all_activities: int,
) -> Dict[str, Any]:
    dates: Dict[str, str] = {}
    if unified_start_date:
        for f in DATE_FIELDS:
            dates[f] = unified_start_date
    elif individual_dates:
        dates.update(individual_dates)
    else:
        raise ValueError("Missing start dates")

    config: Dict[str, Any] = {
        "db": {"type": "sqlite"},
        "garmin": {"domain": "garmin.com"},
        "credentials": {
            "user": username,
            "secure_password": False,
            "password": password if not use_password_file else None,
            "password_file": str(password_file) if use_password_file and password_file else None,
        },
        "data": {
            **dates,
            "download_latest_activities": download_latest_activities,
            "download_all_activities": download_all_activities,
        },
        "directories": {
            "relative_to_home": True,
            "base_dir": "HealthData",
            "mount_dir": "/Volumes/GARMIN",
        },
        "enabled_stats": {
            "monitoring": True,
            "steps": True,
            "itime": True,
            "sleep": True,
            "rhr": True,
            "weight": True,
            "activities": True,
        },
        "course_views": {"steps": []},
        "modes": {},
        "activities": {"display": []},
        "settings": {
            "metric": True,
            "default_display_activities": [
                "walking",
                "running",
                "cycling",
                "strength",
                "jump rope",
            ],
        },
        "checkup": {"look_back_days": 90},
    }
    return config


def write_password_file(password: str, path: Path):
    path.write_text(password + "\n", encoding="utf-8")
    os.chmod(path, 0o600)
    success(f"Password file saved: {path} (chmod 600)")


def write_config(config: Dict[str, Any]):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        backup = CONFIG_FILE.with_suffix(".bak")
        CONFIG_FILE.replace(backup)
        info(f"Existing config backed up to {backup}")
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)
    success(f"Config saved: {CONFIG_FILE}")


def run_garmindb(full: bool, latest: bool):
    if not (full or latest):
        return
    args = [sys.executable, "-m", "garmindb.garmindb_cli", "--all", "--download", "--import", "--analyze"]
    if latest:
        args.append("--latest")
    info("Starting initial garmindb data fetch...")
    try:
        run_cmd(args, check=True)
        success("garmindb process finished")
    except SystemExit:
        error("Error while running garmindb. Check logs.")


def parse_args():
    p = argparse.ArgumentParser(description="Interactive GarminDb setup")
    p.add_argument("--username")
    p.add_argument("--password")  # not recommended (prefer interactive / password file)
    p.add_argument("--start-date", dest="start_date", type=valid_date, help="Single date MM/DD/YYYY for all start fields")
    p.add_argument("--individual-dates", action="store_true", help="Allow entering separate dates for weight/sleep/rhr/monitoring")
    p.add_argument("--download-latest-activities", type=int, default=25)
    p.add_argument("--download-all-activities", type=int, default=1000)
    p.add_argument("--use-password-file", action="store_true")
    p.add_argument("--password-file", type=Path, default=DEFAULT_PASSWORD_FILE)
    p.add_argument("--full", action="store_true", help="After setup, perform a full run (all + latest dataset)")
    p.add_argument("--latest", action="store_true", help="After setup, also add --latest to the run (works with --full)")
    p.add_argument("--upgrade", action="store_true", help="Force pip install --upgrade garmindb")
    return p.parse_args()


def main():
    args = parse_args()
    ensure_python_version()
    install_garmindb(args.upgrade)

    existing = load_existing_config()
    if existing:
        info("Existing config found. A new one will be created based on your answers.")

    username = args.username or input("Enter Garmin username (email): ").strip()
    while not username:
        username = input("(Required) Enter Garmin username (email): ").strip()

    if args.use_password_file:
        password = args.password or getpass("Enter password (it will not be stored in JSON; a file will be created): ")
    else:
        password = args.password or getpass("Enter password (it will be stored in JSON - NOT RECOMMENDED): ")

    # Dates
    unified_start_date: str | None = None
    individual_dates: Dict[str, str] | None = None

    if args.individual_dates:
        individual_dates = {}
        for field in DATE_FIELDS:
            prompt = f"Enter {field} (MM/DD/YYYY): "
            while True:
                v = input(prompt).strip()
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

    use_pw_file = args.use_password_file or prompt_bool("Save password in a separate file (recommended)?", True) if args.password is None else args.use_password_file
    pw_file = args.password_file if use_pw_file else None

    config = build_config(
        username=username,
        password=password,
        unified_start_date=unified_start_date,
        individual_dates=individual_dates,
        use_password_file=use_pw_file,
        password_file=pw_file,
        download_latest_activities=args.download_latest_activities,
        download_all_activities=args.download_all_activities,
    )

    if use_pw_file and password:
        write_password_file(password, pw_file)  # type: ignore[arg-type]
        # Remove password from memory (best effort)
        password = None  # noqa: F841

    write_config(config)

    # Optional first run
    if args.full or prompt_bool("Do you want to run a full import now (--all --download --import --analyze)?", True):
        latest = args.latest or prompt_bool("Also add --latest?", True)
        run_garmindb(full=True, latest=latest)
    else:
        info("Skipped the first run. You can run it manually later:")
        print("  python -m garmindb.garmindb_cli --all --download --import --analyze --latest")

    success("Configuration completed.")
    print("Suggestions:")
    print("  - Backup DB: python -m garmindb.garmindb_cli --backup")
    print("  - Update: pip install --upgrade garmindb")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        warn("Interrupted by user.")
