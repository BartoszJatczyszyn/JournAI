#!/usr/bin/env python3
import sys
import os
sys.path.append('.')

print("Testing database connection...")

try:
    import psycopg2
    from dotenv import load_dotenv
    
    load_dotenv('config.env')
    
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'diary'),
        user=os.getenv('DB_USER', 'diary_user'),
        password=os.getenv('DB_PASSWORD', 'diary123')
    )
    
    cursor = conn.cursor()
    
    # Check if table exists
    cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'garmin_activities');")
    exists = cursor.fetchone()[0]
    
    if exists:
        cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
        count = cursor.fetchone()[0]
        print(f"garmin_activities table exists with {count} records")
        
        if count > 0:
            cursor.execute("SELECT sport, COUNT(*) FROM garmin_activities WHERE sport IS NOT NULL GROUP BY sport LIMIT 3;")
            sports = cursor.fetchall()
            print("Sample sports:")
            for sport, cnt in sports:
                print(f"  {sport}: {cnt}")
    else:
        print("garmin_activities table does not exist")
    
    cursor.close()
    conn.close()
    print("Database test completed successfully")
    
except Exception as e:
    print(f"Database test failed: {e}")
    import traceback
    traceback.print_exc()

print("Script finished")