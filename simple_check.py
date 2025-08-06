#!/usr/bin/env python3
print("=== Simple Check ===")

try:
    print("Testing imports...")
    import os
    import sys
    from pathlib import Path
    print("✅ Basic imports work")
    
    # Check config
    if Path("config.env").exists():
        print("✅ config.env found")
        
        # Load config
        with open("config.env", "r") as f:
            content = f.read()
            print("Config content:")
            print(content)
    else:
        print("❌ config.env not found")
    
    # Check HealthData path
    health_data_path = "C:/Users/barto/HealthData"
    if Path(health_data_path).exists():
        print(f"✅ HealthData exists at {health_data_path}")
        
        # Count files
        sleep_dir = Path(health_data_path) / "Sleep"
        if sleep_dir.exists():
            sleep_files = list(sleep_dir.glob("*.json"))
            print(f"✅ Sleep files: {len(sleep_files)}")
        
        rhr_dir = Path(health_data_path) / "RHR"
        if rhr_dir.exists():
            rhr_files = list(rhr_dir.glob("*.json"))
            print(f"✅ RHR files: {len(rhr_files)}")
            
        weight_dir = Path(health_data_path) / "Weight"
        if weight_dir.exists():
            weight_files = list(weight_dir.glob("*.json"))
            print(f"✅ Weight files: {len(weight_files)}")
    else:
        print(f"❌ HealthData not found at {health_data_path}")
    
    # Test database packages
    try:
        import psycopg2
        print("✅ psycopg2 available")
    except ImportError as e:
        print(f"❌ psycopg2 not available: {e}")
    
    try:
        import sqlalchemy
        print("✅ sqlalchemy available")
    except ImportError as e:
        print(f"❌ sqlalchemy not available: {e}")
    
    try:
        from dotenv import load_dotenv
        print("✅ python-dotenv available")
    except ImportError as e:
        print(f"❌ python-dotenv not available: {e}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("=== Check Complete ===")