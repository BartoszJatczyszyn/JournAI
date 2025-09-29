#!/usr/bin/env python3
"""
Automatyczny update HealthData i dogranie zmian do bazy PostgreSQL.

Kroki:
1) Sprawdza istnienie folderu HealthData (HEALTH_DATA_PATH z AI/config.env lub domyślnie ../HealthData)
2) Uruchamia garmindb_cli.py --all --download --import --analyze --latest (jeśli dostępny w PATH)
3) Wykrywa, czy pojawiły się nowe dane (porównuje liczbę plików i mtime w DBs)
4) Jeśli tak – uruchamia migrację (idempotentna; upsert)

Uruchomienie:
  cd AI
  python update_healthdata_and_migrate.py

Uwaga: garmindb_cli.py wymaga skonfigurowanych poświadczeń (np. przez GarminDb),
i zwykle działa w środowisku użytkownika (poza kontenerem Dockera).
"""
import os
import sys
import time
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Ensure we can import enhanced_migration from AI/
sys.path.insert(0, str(SCRIPT_DIR))

DEFAULT_HEALTHDATA = PROJECT_ROOT / 'HealthData'
CONFIG_CANDIDATES = [SCRIPT_DIR / 'config.env', PROJECT_ROOT / 'AI' / 'config.env']

@dataclass
class Snapshot:
    sleep_count: int
    rhr_count: int
    weight_count: int
    fit_count: int
    dbs_mtime_sum: float


def load_config_env() -> None:
    if load_dotenv is None:
        return
    for p in CONFIG_CANDIDATES:
        if p.exists():
            load_dotenv(p)
            break


def resolve_healthdata_path() -> Path:
    env_val = os.getenv('HEALTH_DATA_PATH')
    if env_val:
        p = Path(env_val)
        if not p.is_absolute():
            p = (SCRIPT_DIR / p).resolve()
        return p
    # fallback
    return DEFAULT_HEALTHDATA


def snapshot_healthdata(hp: Path) -> Snapshot:
    def count_in(sub: str, pattern: str) -> int:
        d = hp / sub
        if not d.exists():
            return 0
        return sum(1 for _ in d.glob(pattern))

    def dbs_mtime() -> float:
        d = hp / 'DBs'
        total = 0.0
        if d.exists():
            for name in ['garmin.db', 'garmin_activities.db', 'garmin_monitoring.db', 'garmin_summary.db', 'summary.db']:
                fp = d / name
                if fp.exists():
                    try:
                        total += fp.stat().st_mtime
                    except Exception:
                        pass
        return total

    return Snapshot(
        sleep_count=count_in('Sleep', '*.json'),
        rhr_count=count_in('RHR', '*.json'),
        weight_count=count_in('Weight', '*.json'),
        fit_count=count_in('FitFiles', '*.*'),
        dbs_mtime_sum=dbs_mtime(),
    )


def find_garmindb_cli() -> Optional[str]:
    candidates = [
        'garmindb_cli.py',  # common
        'garmindb_cli',     # installed entry point
        'GarminDbCLI.py',
    ]
    for c in candidates:
        exe = shutil.which(c)
        if exe:
            return exe
    return None


def run_garmindb_cli(health_path: Path) -> int:
    cli = find_garmindb_cli()
    if not cli:
        print('⚠️  Nie znaleziono garmindb_cli.py w PATH. Pomijam etap pobierania.')
        return 127
    cmd = [cli, '--all', '--download', '--import', '--analyze', '--latest']
    print(f'▶️  Uruchamiam: {" ".join(cmd)} (cwd={health_path})')
    try:
        res = subprocess.run(cmd, cwd=str(health_path), check=False, capture_output=True, text=True)
        print(res.stdout)
        if res.stderr:
            print(res.stderr, file=sys.stderr)
        return res.returncode
    except Exception as e:
        print(f'❌ Błąd uruchamiania garmindb_cli: {e}')
        return 1


def has_changes(before: Snapshot, after: Snapshot) -> bool:
    return (
        after.sleep_count > before.sleep_count
        or after.rhr_count > before.rhr_count
        or after.weight_count > before.weight_count
        or after.fit_count > before.fit_count
        or abs(after.dbs_mtime_sum - before.dbs_mtime_sum) > 0.0001
    )


def migrate_all():
    print('🚀 Uruchamiam migrację (idempotentna, upsert)...')
    try:
        from enhanced_migration import EnhancedGarminMigrator
    except Exception as e:
        print(f'❌ Nie mogę zaimportować EnhancedGarminMigrator: {e}')
        return 1

    m = EnhancedGarminMigrator()
    # Selektor kroków – wszystkie główne strumienie
    m.migrate_sleep_data()
    m.migrate_rhr_data()
    m.migrate_daily_summary_data()
    m.migrate_heart_rate_data()
    m.migrate_respiratory_rate_data()
    m.migrate_activities_data()
    print('✅ Migracja zakończona')
    return 0


def main() -> int:
    load_config_env()
    health_path = resolve_healthdata_path()
    print(f'ℹ️  HEALTH_DATA_PATH: {health_path}')
    if not health_path.exists():
        print('❌ Folder HealthData nie istnieje. Przerwano.')
        return 2

    before = snapshot_healthdata(health_path)

    # Próba pobrania nowych danych
    rc = run_garmindb_cli(health_path)
    if rc not in (0, 127):  # 127: brak CLI – wtedy po prostu spróbujemy i tak migrować istniejące dane
        print(f'⚠️  garmindb_cli zakończył się z kodem {rc} – kontynuuję tylko jeśli wykryję zmiany…')

    # Odśwież snapshot po pobraniu
    after = snapshot_healthdata(health_path)

    if has_changes(before, after) or rc == 127:
        if rc == 127:
            print('ℹ️  CLI nieobecny – wykonuję migrację istniejących danych.')
        else:
            print('✅ Wykryto zmiany – uruchamiam migrację…')
        return migrate_all()
    else:
        print('ℹ️  Nie wykryto nowych danych – migracja pominięta.')
        return 0


if __name__ == '__main__':
    sys.exit(main())
