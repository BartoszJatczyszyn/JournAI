import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('config.env')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'diary'),
    'user': os.getenv('DB_USER', 'diary_user'),
    'password': os.getenv('DB_PASSWORD', 'diary123')
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Check if table exists and count
    cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
    count = cursor.fetchone()[0]
    print(f"Activities in PostgreSQL: {count}")
    
    if count > 0:
        # Show sports
        cursor.execute("SELECT sport, COUNT(*) FROM garmin_activities WHERE sport IS NOT NULL GROUP BY sport ORDER BY COUNT(*) DESC LIMIT 5;")
        sports = cursor.fetchall()
        print("Top sports:")
        for sport, cnt in sports:
            print(f"  {sport}: {cnt}")
        
        # Show recent activity
        cursor.execute("SELECT sport, name, start_time, distance, calories FROM garmin_activities WHERE start_time IS NOT NULL ORDER BY start_time DESC LIMIT 1;")
        recent = cursor.fetchone()
        if recent:
            sport, name, start_time, distance, calories = recent
            dist_km = f"{distance/1000:.1f}km" if distance else "N/A"
            print(f"Most recent: {sport} - {name} ({start_time.date()}) - {dist_km}, {calories}cal")
    
    cursor.close()
    conn.close()
    print("SUCCESS: Database connection and query worked!")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()