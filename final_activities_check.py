#!/usr/bin/env python3

# Simple check without external dependencies first
print("=== GARMIN ACTIVITIES MIGRATION CHECK ===")

try:
    # Test basic imports
    import os
    import sys
    print("✅ Basic imports work")
    
    # Check if source database exists
    from dotenv import load_dotenv
    load_dotenv('config.env')
    health_data = os.getenv('HEALTH_DATA_PATH', '../HealthData')
    source_db = os.path.join(health_data, 'DBs', 'garmin_activities.db')
    if os.path.exists(source_db):
        print(f"✅ Source database exists at {source_db}: {os.path.getsize(source_db)} bytes")
    else:
        print(f"❌ Source database not found at {source_db}")
        sys.exit(1)
    
    # Test SQLite connection
    import sqlite3
    conn = sqlite3.connect(source_db)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM activities")
    source_count = cursor.fetchone()[0]
    print(f"✅ Source activities: {source_count}")
    conn.close()
    
    # Test PostgreSQL connection
    import psycopg2
    from dotenv import load_dotenv
    
    load_dotenv('config.env')
    
    pg_conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'diary'),
        user=os.getenv('DB_USER', 'diary_user'),
        password=os.getenv('DB_PASSWORD', 'diary123')
    )
    print("✅ PostgreSQL connection successful")
    
    cursor = pg_conn.cursor()
    
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
        
        # Count records
        cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
        pg_count = cursor.fetchone()[0]
        print(f"✅ PostgreSQL activities: {pg_count}")
        
        # Calculate migration percentage
        if source_count > 0:
            percentage = (pg_count / source_count) * 100
            print(f"📊 Migration rate: {percentage:.1f}%")
            
            if percentage >= 95:
                print("🎉 MIGRATION SUCCESSFUL!")
            elif percentage >= 50:
                print("⚠️ PARTIAL MIGRATION")
            else:
                print("❌ MIGRATION INCOMPLETE")
        
        # Show sample data if exists
        if pg_count > 0:
            cursor.execute("""
                SELECT sport, COUNT(*) 
                FROM garmin_activities 
                WHERE sport IS NOT NULL 
                GROUP BY sport 
                ORDER BY COUNT(*) DESC 
                LIMIT 5
            """)
            sports = cursor.fetchall()
            print("\n🏃 Top activity types:")
            for sport, count in sports:
                print(f"  • {sport}: {count}")
            
            # Show recent activity with key metrics
            cursor.execute("""
                SELECT 
                    sport, 
                    name, 
                    start_time::date,
                    ROUND(distance/1000.0, 1) as distance_km,
                    calories,
                    avg_hr,
                    avg_cadence
                FROM garmin_activities 
                WHERE start_time IS NOT NULL
                ORDER BY start_time DESC 
                LIMIT 3
            """)
            recent = cursor.fetchall()
            print("\n📋 Recent activities:")
            for sport, name, date, dist, cal, hr, cadence in recent:
                metrics = []
                if dist: metrics.append(f"{dist}km")
                if cal: metrics.append(f"{cal}cal")
                if hr: metrics.append(f"{hr}bpm")
                if cadence: metrics.append(f"{cadence}spm")
                
                print(f"  • {sport} ({date}): {name}")
                if metrics:
                    print(f"    {', '.join(metrics)}")
    else:
        print("❌ garmin_activities table does not exist")
        print("🔧 Need to run migration script")
    
    pg_conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== CHECK COMPLETE ===")