import sqlite3
import os

# Check if file exists
db_path = r'C:\Users\barto\HealthData\DBs\garmin_activities.db'
print(f"Checking: {db_path}")
print(f"File exists: {os.path.exists(db_path)}")

if os.path.exists(db_path):
    print(f"File size: {os.path.getsize(db_path)} bytes")
    
    # Try to connect
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {[t[0] for t in tables]}")
        
        # Check activities table
        if any('activities' in str(t) for t in tables):
            cursor.execute("SELECT COUNT(*) FROM activities;")
            count = cursor.fetchone()[0]
            print(f"Activities count: {count}")
            
            # Get first few columns
            cursor.execute("PRAGMA table_info(activities);")
            columns = cursor.fetchall()
            print("First 10 columns:")
            for i, col in enumerate(columns[:10]):
                print(f"  {col[1]} ({col[2]})")
        
        conn.close()
        
    except Exception as e:
        print(f"SQLite error: {e}")
else:
    print("File not found!")