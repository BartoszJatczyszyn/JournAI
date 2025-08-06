#!/usr/bin/env python3
"""
Setup script for Garmin to PostgreSQL migration
This script will install required packages and test the database connection
"""

import subprocess
import sys
import os
from pathlib import Path

def install_requirements():
    """Install required Python packages"""
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def test_database_connection():
    """Test PostgreSQL connection"""
    try:
        import psycopg2
        from dotenv import load_dotenv
        
        # Load environment variables
        load_dotenv('config.env')
        
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'garmin_health'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'your_password_here')
        )
        conn.close()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("Please check your PostgreSQL configuration in config.env")
        return False

def check_health_data():
    """Check if Garmin health data exists"""
    health_data_path = Path("C:/Users/barto/HealthData")
    if not health_data_path.exists():
        print("❌ HealthData directory not found")
        return False
    
    # Check for key directories
    required_dirs = ["Sleep", "RHR", "Weight", "DBs"]
    missing_dirs = []
    
    for dir_name in required_dirs:
        if not (health_data_path / dir_name).exists():
            missing_dirs.append(dir_name)
    
    if missing_dirs:
        print(f"⚠️  Missing directories: {missing_dirs}")
        print("Some data migration may be incomplete")
    else:
        print("✅ All health data directories found")
    
    return True

def main():
    """Main setup function"""
    print("🚀 Setting up Garmin to PostgreSQL migration...")
    print("=" * 50)
    
    success = True
    
    # Install requirements
    if not install_requirements():
        success = False
    
    # Check health data
    if not check_health_data():
        success = False
    
    # Test database connection
    if not test_database_connection():
        success = False
        print("\n📝 To fix database connection:")
        print("1. Make sure PostgreSQL is running")
        print("2. Create database: CREATE DATABASE garmin_health;")
        print("3. Update config.env with correct credentials")
    
    print("\n" + "=" * 50)
    if success:
        print("✅ Setup completed successfully!")
        print("You can now run: python garmin_to_postgresql_migration.py")
    else:
        print("❌ Setup completed with errors. Please fix the issues above.")
    
    return success

if __name__ == "__main__":
    main()