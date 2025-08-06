#!/usr/bin/env python3
"""
Direct database check without dependencies
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('config.env')

def check_database():
    """Check database directly"""
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            port=int(os.getenv('DB_PORT')),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )
        
        cursor = conn.cursor()
        
        print("🔍 Checking Database Status")
        print("=" * 30)
        
        # Check table structure
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'garmin_sleep_sessions' 
            AND column_name = 'sleep_id'
        """)
        
        result = cursor.fetchone()
        if result:
            column_name, data_type = result
            print(f"✅ sleep_id column type: {data_type}")
            
            if data_type == 'bigint':
                print("✅ Table structure is correct (BIGINT)")
            else:
                print(f"❌ Table structure needs fixing (currently {data_type})")
        else:
            print("❌ garmin_sleep_sessions table not found")
        
        # Count records in each table
        tables = [
            'garmin_daily_summaries',
            'garmin_sleep_sessions', 
            'garmin_weight',
            'daily_journal'
        ]
        
        print(f"\n📊 Record Counts:")
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table}: {count}")
            except Exception as e:
                print(f"  {table}: Error - {e}")
        
        # Check for sample sleep data
        try:
            cursor.execute("SELECT sleep_id, day, sleep_duration_seconds, sleep_score FROM garmin_sleep_sessions LIMIT 3")
            sleep_records = cursor.fetchall()
            
            if sleep_records:
                print(f"\n📝 Sample Sleep Records:")
                for record in sleep_records:
                    sleep_id, day, duration, score = record
                    duration_hours = duration / 3600 if duration else 0
                    print(f"  {day}: ID={sleep_id}, Duration={duration_hours:.1f}h, Score={score}")
            else:
                print(f"\n❌ No sleep records found")
                
        except Exception as e:
            print(f"\n❌ Error checking sleep records: {e}")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

if __name__ == "__main__":
    check_database()