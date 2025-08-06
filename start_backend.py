#!/usr/bin/env python3
"""
Quick start script for the backend API
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages"""
    print("📦 Installing Python requirements...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Python packages installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing packages: {e}")
        return False

def check_database():
    """Check database connection"""
    print("🔍 Checking database connection...")
    try:
        from dotenv import load_dotenv
        import psycopg2
        
        load_dotenv('config.env')
        
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'diary'),
            user=os.getenv('DB_USER', 'diary_user'),
            password=os.getenv('DB_PASSWORD', 'diary123')
        )
        conn.close()
        print("✅ Database connection successful!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Make sure PostgreSQL is running and config.env is correct")
        return False

def start_backend():
    """Start the Flask backend"""
    print("🚀 Starting backend API server...")
    try:
        from backend_api import app
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"❌ Error starting backend: {e}")

if __name__ == "__main__":
    print("🏥 Garmin Health Dashboard - Backend Startup")
    print("=" * 50)
    
    # Install requirements
    if not install_requirements():
        sys.exit(1)
    
    # Check database
    if not check_database():
        print("\n⚠️  Database connection failed, but starting anyway...")
        print("   You can fix the database later and restart.")
    
    print("\n🌐 Backend will be available at: http://localhost:5000")
    print("📊 API endpoints will be at: http://localhost:5000/api/")
    print("\n🔥 Starting server...")
    
    start_backend()