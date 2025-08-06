#!/usr/bin/env python3
"""
Check structure of garmin_activities.db
"""

import sqlite3
import os

def check_db_structure():
    db_path = '../HealthData/DBs/garmin_activities.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"📊 Tables in database: {tables}")
        
        # Check activities table structure
        if 'activities' in tables:
            cursor.execute("PRAGMA table_info(activities);")
            columns = cursor.fetchall()
            print(f"\n🏃 Activities table structure:")
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
            
            # Get sample data
            cursor.execute("SELECT COUNT(*) FROM activities;")
            count = cursor.fetchone()[0]
            print(f"\n📈 Total activities: {count}")
            
            if count > 0:
                cursor.execute("SELECT * FROM activities LIMIT 3;")
                sample_data = cursor.fetchall()
                print(f"\n📋 Sample data (first 3 rows):")
                for i, row in enumerate(sample_data):
                    print(f"  Row {i+1}: {row[:10]}...")  # First 10 columns
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_db_structure()