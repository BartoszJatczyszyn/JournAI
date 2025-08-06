#!/usr/bin/env python3
"""
Check if activities migration was successful
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('config.env')

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'diary'),
    'user': os.getenv('DB_USER', 'diary_user'),
    'password': os.getenv('DB_PASSWORD', 'diary123')
}

def check_migration():
    """Check migration status"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'garmin_activities'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if table_exists:
            print("✅ garmin_activities table exists")
            
            # Count activities
            cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
            count = cursor.fetchone()[0]
            print(f"📊 Total activities: {count}")
            
            if count > 0:
                # Show activity types
                cursor.execute("""
                    SELECT sport, COUNT(*) as count 
                    FROM garmin_activities 
                    WHERE sport IS NOT NULL 
                    GROUP BY sport 
                    ORDER BY count DESC 
                    LIMIT 10
                """)
                sports = cursor.fetchall()
                print("\n🏃 Activity types:")
                for sport, cnt in sports:
                    print(f"  • {sport}: {cnt}")
                
                # Show date range
                cursor.execute("""
                    SELECT MIN(start_time), MAX(start_time) 
                    FROM garmin_activities 
                    WHERE start_time IS NOT NULL
                """)
                date_range = cursor.fetchone()
                if date_range[0]:
                    print(f"\n📅 Date range: {date_range[0]} to {date_range[1]}")
                
                # Show sample data
                cursor.execute("""
                    SELECT sport, name, start_time, distance, calories, avg_hr
                    FROM garmin_activities 
                    WHERE start_time IS NOT NULL
                    ORDER BY start_time DESC 
                    LIMIT 5
                """)
                samples = cursor.fetchall()
                print("\n📋 Recent activities:")
                for sport, name, start_time, distance, calories, avg_hr in samples:
                    dist_km = f"{distance/1000:.1f}km" if distance else "N/A"
                    hr_str = f"{avg_hr}bpm" if avg_hr else "N/A"
                    print(f"  • {sport}: {name} - {dist_km}, {calories}cal, {hr_str}")
            
        else:
            print("❌ garmin_activities table does not exist")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_migration()