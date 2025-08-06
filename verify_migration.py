#!/usr/bin/env python3
"""
Verify garmin_activities migration status
"""

import os
import psycopg2
import sqlite3
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

def check_source_db():
    """Check source SQLite database"""
    db_path = '../HealthData/DBs/garmin_activities.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Source database not found: {db_path}")
        return 0
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM activities;")
        count = cursor.fetchone()[0]
        print(f"📊 Source SQLite activities: {count}")
        
        # Show sample sports
        cursor.execute("SELECT DISTINCT sport FROM activities WHERE sport IS NOT NULL LIMIT 5;")
        sports = [row[0] for row in cursor.fetchall()]
        print(f"🏃 Sample sports: {sports}")
        
        conn.close()
        return count
        
    except Exception as e:
        print(f"❌ Error checking source: {e}")
        return 0

def check_target_db():
    """Check target PostgreSQL database"""
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
        
        if not table_exists:
            print("❌ garmin_activities table does not exist in PostgreSQL")
            return 0
        
        print("✅ garmin_activities table exists")
        
        # Count activities
        cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
        count = cursor.fetchone()[0]
        print(f"📊 PostgreSQL activities: {count}")
        
        if count > 0:
            # Show activity types
            cursor.execute("""
                SELECT sport, COUNT(*) as count 
                FROM garmin_activities 
                WHERE sport IS NOT NULL 
                GROUP BY sport 
                ORDER BY count DESC 
                LIMIT 5
            """)
            sports = cursor.fetchall()
            print("🏃 Top activity types:")
            for sport, cnt in sports:
                print(f"  • {sport}: {cnt}")
            
            # Show date range
            cursor.execute("""
                SELECT MIN(start_time)::date, MAX(start_time)::date 
                FROM garmin_activities 
                WHERE start_time IS NOT NULL
            """)
            date_range = cursor.fetchone()
            if date_range[0]:
                print(f"📅 Date range: {date_range[0]} to {date_range[1]}")
            
            # Show recent activities with key metrics
            cursor.execute("""
                SELECT 
                    sport, 
                    name, 
                    start_time::date,
                    ROUND(distance/1000.0, 1) as distance_km,
                    calories,
                    avg_hr,
                    ROUND(avg_pace, 1) as pace_min_km,
                    avg_cadence,
                    ROUND(avg_step_length, 2) as step_length,
                    ROUND(avg_vertical_oscillation, 1) as vertical_osc,
                    ROUND(avg_ground_contact_time, 0) as ground_contact
                FROM garmin_activities 
                WHERE start_time IS NOT NULL
                ORDER BY start_time DESC 
                LIMIT 3
            """)
            samples = cursor.fetchall()
            print("\n📋 Recent activities with running dynamics:")
            for row in samples:
                sport, name, date, dist, cal, hr, pace, cadence, step_len, vert_osc, ground = row
                print(f"  • {sport} ({date}): {name}")
                if dist: print(f"    Distance: {dist}km")
                if cal: print(f"    Calories: {cal}")
                if hr: print(f"    Avg HR: {hr}bpm")
                if pace: print(f"    Pace: {pace} min/km")
                if cadence: print(f"    Cadence: {cadence} spm")
                if step_len: print(f"    Step length: {step_len}m")
                if vert_osc: print(f"    Vertical oscillation: {vert_osc}cm")
                if ground: print(f"    Ground contact time: {ground}ms")
                print()
        
        cursor.close()
        conn.close()
        return count
        
    except Exception as e:
        print(f"❌ Error checking PostgreSQL: {e}")
        import traceback
        traceback.print_exc()
        return 0

def main():
    print("🔍 Verifying garmin_activities migration...")
    print("=" * 50)
    
    source_count = check_source_db()
    print()
    target_count = check_target_db()
    
    print("\n" + "=" * 50)
    print("📊 MIGRATION SUMMARY:")
    print(f"Source (SQLite): {source_count} activities")
    print(f"Target (PostgreSQL): {target_count} activities")
    
    if source_count > 0 and target_count > 0:
        percentage = (target_count / source_count) * 100
        print(f"Migration rate: {percentage:.1f}%")
        
        if percentage >= 95:
            print("✅ Migration appears successful!")
        elif percentage >= 50:
            print("⚠️ Partial migration - some data may be missing")
        else:
            print("❌ Migration incomplete - most data missing")
    elif source_count == 0:
        print("⚠️ No source data found")
    elif target_count == 0:
        print("❌ No data migrated")

if __name__ == "__main__":
    main()