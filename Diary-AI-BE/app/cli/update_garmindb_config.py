#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

DEFAULT_LATEST = int(os.getenv("LATEST_ACTIVITIES", "25"))

CONFIG_PATHS = [
    Path.home() / ".GarminDb" / "GarminConnectConfig.json",
]

def patch_config(path: Path, latest: int) -> bool:
    try:
        if not path.exists():
            print(f"Config not found at {path}")
            return False
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        # Ensure nested structure exists
        data.setdefault("data", {})
        data["data"]["download_latest_activities"] = latest
        # Write back
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        tmp_path.replace(path)
        print(f"Patched {path} download_latest_activities = {latest}")
        return True
    except Exception as e:
        print(f"Failed to patch {path}: {e}")
        return False


def main():
    latest = DEFAULT_LATEST
    if len(sys.argv) >= 2:
        try:
            latest = int(sys.argv[1])
        except ValueError:
            print(f"Invalid latest activities value: {sys.argv[1]}")
            sys.exit(2)

    ok_any = False
    for p in CONFIG_PATHS:
        if patch_config(p, latest):
            ok_any = True
    sys.exit(0 if ok_any else 1)


if __name__ == "__main__":
    main()
