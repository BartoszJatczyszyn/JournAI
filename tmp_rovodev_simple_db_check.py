import sqlite3
import os

db_path = '../HealthData/DBs/garmin_activities.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables:", tables)
    
    if 'activities' in tables:
        cursor.execute("PRAGMA table_info(activities);")
        columns = cursor.fetchall()
        print("Activities columns:")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        cursor.execute("SELECT COUNT(*) FROM activities;")
        count = cursor.fetchone()[0]
        print(f"Total activities: {count}")
    
    conn.close()
else:
    print("Database not found")