#!/usr/bin/env python3
import os
import sys
from pathlib import Path

print("=== Python Test ===")
print(f"Python version: {sys.version}")
print(f"Current directory: {os.getcwd()}")

# Check config
config_path = Path("config.env")
if config_path.exists():
    print("Config file found")
    with open(config_path, "r") as f:
        print("Config content:")
        print(f.read())
else:
    print("Config file not found")

# Check HealthData
health_data_path = Path("../HealthData")
if health_data_path.exists():
    print(f"HealthData found at {health_data_path.absolute()}")
    
    sleep_dir = health_data_path / "Sleep"
    if sleep_dir.exists():
        sleep_files = list(sleep_dir.glob("*.json"))
        print(f"Sleep files: {len(sleep_files)}")
    
    rhr_dir = health_data_path / "RHR"
    if rhr_dir.exists():
        rhr_files = list(rhr_dir.glob("*.json"))
        print(f"RHR files: {len(rhr_files)}")
        
    weight_dir = health_data_path / "Weight"
    if weight_dir.exists():
        weight_files = list(weight_dir.glob("*.json"))
        print(f"Weight files: {len(weight_files)}")
else:
    print("HealthData not found")

print("=== Test Complete ===")