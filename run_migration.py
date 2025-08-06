#!/usr/bin/env python3
"""
Main script to run the complete Garmin data migration
"""

import sys
import os
from pathlib import Path

def check_requirements():
    """Check if all requirements are met"""
    errors = []
    
    # Check if HealthData directory exists
    if not Path("C:/Users/barto/HealthData").exists():
        errors.append("HealthData directory not found")
    
    # Check if config file exists
    if not Path("config.env").exists():
        errors.append("config.env file not found")
    
    # Check if required Python packages are installed
    try:
        import psycopg2
        import sqlalchemy
        import pandas
        from dotenv import load_dotenv
    except ImportError as e:
        errors.append(f"Missing Python package: {e}")
    
    return errors

def main():
    """Main function"""
    print("🚀 Starting Garmin Data Migration")
    print("=" * 50)
    
    # Check requirements
    errors = check_requirements()
    if errors:
        print("❌ Requirements check failed:")
        for error in errors:
            print(f"  - {error}")
        print("\nPlease run: python setup_migration.py")
        return False
    
    print("✅ Requirements check passed")
    
    # Run the migration
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        migrator = EnhancedGarminMigrator()
        migrator.run_migration()
        
        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Use data_manager.py to analyze your data")
        print("2. Update journal entries with your daily notes")
        print("3. Run queries to find patterns in your health data")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print("\nPlease check:")
        print("1. PostgreSQL is running")
        print("2. Database credentials in config.env are correct")
        print("3. HealthData directory contains your Garmin data")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)