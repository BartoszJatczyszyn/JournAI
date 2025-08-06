#!/usr/bin/env python3
"""
Fix activities table and complete migration
"""

import os
import sqlite3
import psycopg2
from datetime import datetime, date
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

def fix_activities_table():
    """Drop and recreate activities table with correct structure"""
    
    create_table_sql = """
    DROP TABLE IF EXISTS garmin_activities CASCADE;
    
    CREATE TABLE garmin_activities (
        activity_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        sport VARCHAR(100),
        sub_sport VARCHAR(100),
        start_time TIMESTAMP WITH TIME ZONE,
        stop_time TIMESTAMP WITH TIME ZONE,
        day DATE,
        
        -- Duration and distance
        elapsed_time INTEGER,           -- seconds (converted from TIME)
        moving_time INTEGER,            -- seconds (converted from TIME)
        distance FLOAT,                 -- meters
        
        -- Performance metrics
        calories INTEGER,
        training_load FLOAT,
        training_effect FLOAT,
        anaerobic_training_effect FLOAT,
        self_eval_feel INTEGER,
        self_eval_effort INTEGER,
        
        -- Heart rate
        avg_hr INTEGER,
        max_hr INTEGER,
        
        -- Speed and pace
        avg_speed FLOAT,                -- m/s
        max_speed FLOAT,                -- m/s
        avg_pace FLOAT,                 -- min/km (calculated)
        
        -- Cadence
        avg_cadence INTEGER,
        max_cadence INTEGER,
        
        -- Elevation
        ascent FLOAT,                   -- meters
        descent FLOAT,                  -- meters
        
        -- Temperature
        avg_temperature FLOAT,          -- celsius
        max_temperature FLOAT,          -- celsius
        min_temperature FLOAT,          -- celsius
        
        -- GPS coordinates
        start_lat FLOAT,
        start_long FLOAT,
        stop_lat FLOAT,
        stop_long FLOAT,
        
        -- Additional metrics
        cycles FLOAT,
        avg_rr FLOAT,                   -- respiratory rate
        max_rr FLOAT,                   -- respiratory rate
        
        -- Heart rate zones
        hr_zones_method VARCHAR(50),
        hrz_1_hr INTEGER,
        hrz_2_hr INTEGER,
        hrz_3_hr INTEGER,
        hrz_4_hr INTEGER,
        hrz_5_hr INTEGER,
        hrz_1_time INTEGER,             -- seconds (converted from TIME)
        hrz_2_time INTEGER,             -- seconds (converted from TIME)
        hrz_3_time INTEGER,             -- seconds (converted from TIME)
        hrz_4_time INTEGER,             -- seconds (converted from TIME)
        hrz_5_time INTEGER,             -- seconds (converted from TIME)
        
        -- Derived metrics
        steps_per_minute FLOAT,         -- calculated
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes for better performance
    CREATE INDEX idx_garmin_activities_start_time ON garmin_activities(start_time);
    CREATE INDEX idx_garmin_activities_day ON garmin_activities(day);
    CREATE INDEX idx_garmin_activities_sport ON garmin_activities(sport);
    CREATE INDEX idx_garmin_activities_sub_sport ON garmin_activities(sub_sport);
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔧 Recreating garmin_activities table with correct structure...")
        cursor.execute(create_table_sql)
        
        conn.commit()
        print("✅ Activities table recreated successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error recreating table: {e}")
        raise

def time_to_seconds(time_str):
    """Convert TIME string to seconds"""
    if not time_str:
        return None
    try:
        # Handle format like "01:23:45" or "1:23:45"
        parts = str(time_str).split(':')
        if len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        else:
            return int(float(time_str))
    except:
        return None

def migrate_activities():
    """Migrate activities from SQLite to PostgreSQL"""
    
    print("🚀 Starting fixed Garmin activities migration...")
    
    # Fix the table structure first
    fix_activities_table()
    
    # Connect to both databases
    sqlite_path = '../HealthData/DBs/garmin_activities.db'
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_cursor = sqlite_conn.cursor()
    
    pg_conn = psycopg2.connect(**DB_CONFIG)
    pg_cursor = pg_conn.cursor()
    
    try:
        # Get all columns from SQLite activities table
        sqlite_cursor.execute("PRAGMA table_info(activities);")
        sqlite_columns = [col[1] for col in sqlite_cursor.fetchall()]
        print(f"📋 Available columns in source: {len(sqlite_columns)} columns")
        
        # Map SQLite columns to PostgreSQL columns (based on actual structure)
        column_mapping = {
            'activity_id': 'activity_id',
            'name': 'name', 
            'description': 'description',
            'sport': 'sport',
            'sub_sport': 'sub_sport',
            'start_time': 'start_time',
            'stop_time': 'stop_time',
            'elapsed_time': 'elapsed_time',
            'moving_time': 'moving_time',
            'distance': 'distance',
            'calories': 'calories',
            'training_load': 'training_load',
            'training_effect': 'training_effect',
            'anaerobic_training_effect': 'anaerobic_training_effect',
            'self_eval_feel': 'self_eval_feel',
            'self_eval_effort': 'self_eval_effort',
            'avg_hr': 'avg_hr',
            'max_hr': 'max_hr',
            'avg_speed': 'avg_speed',
            'max_speed': 'max_speed',
            'avg_cadence': 'avg_cadence',
            'max_cadence': 'max_cadence',
            'ascent': 'ascent',
            'descent': 'descent',
            'avg_temperature': 'avg_temperature',
            'max_temperature': 'max_temperature',
            'min_temperature': 'min_temperature',
            'start_lat': 'start_lat',
            'start_long': 'start_long',
            'stop_lat': 'stop_lat',
            'stop_long': 'stop_long',
            'cycles': 'cycles',
            'avg_rr': 'avg_rr',
            'max_rr': 'max_rr',
            'hr_zones_method': 'hr_zones_method',
            'hrz_1_hr': 'hrz_1_hr',
            'hrz_2_hr': 'hrz_2_hr',
            'hrz_3_hr': 'hrz_3_hr',
            'hrz_4_hr': 'hrz_4_hr',
            'hrz_5_hr': 'hrz_5_hr',
            'hrz_1_time': 'hrz_1_time',
            'hrz_2_time': 'hrz_2_time',
            'hrz_3_time': 'hrz_3_time',
            'hrz_4_time': 'hrz_4_time',
            'hrz_5_time': 'hrz_5_time'
        }
        
        # Find available columns
        available_columns = []
        for sqlite_col, pg_col in column_mapping.items():
            if sqlite_col in sqlite_columns:
                available_columns.append((sqlite_col, pg_col))
        
        print(f"📊 Mapping {len(available_columns)} columns")
        
        # Build SELECT query
        select_cols = [col[0] for col in available_columns]
        select_query = f"SELECT {', '.join(select_cols)} FROM activities ORDER BY start_time"
        
        # Execute query
        print(f"🔄 Fetching activities from SQLite...")
        sqlite_cursor.execute(select_query)
        
        migrated_count = 0
        error_count = 0
        batch_size = 100
        
        while True:
            rows = sqlite_cursor.fetchmany(batch_size)
            if not rows:
                break
                
            for row in rows:
                try:
                    # Prepare data for insertion
                    data = {}
                    for i, (sqlite_col, pg_col) in enumerate(available_columns):
                        value = row[i]
                        
                        # Convert data types
                        if sqlite_col in ['start_time', 'stop_time'] and value:
                            if isinstance(value, str):
                                try:
                                    data[pg_col] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                except:
                                    try:
                                        data[pg_col] = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                                    except:
                                        data[pg_col] = None
                            else:
                                data[pg_col] = None
                        elif sqlite_col in ['elapsed_time', 'moving_time', 'hrz_1_time', 'hrz_2_time', 'hrz_3_time', 'hrz_4_time', 'hrz_5_time']:
                            # Convert TIME to seconds
                            data[pg_col] = time_to_seconds(value)
                        elif sqlite_col in ['self_eval_feel', 'self_eval_effort']:
                            # Convert string to integer if possible
                            try:
                                data[pg_col] = int(value) if value else None
                            except:
                                data[pg_col] = None
                        else:
                            data[pg_col] = value
                    
                    # Skip if no activity_id
                    if not data.get('activity_id'):
                        continue
                    
                    # Calculate derived fields
                    if 'start_time' in data and data['start_time']:
                        data['day'] = data['start_time'].date()
                    
                    # Calculate pace if we have distance and time
                    if data.get('distance') and data.get('moving_time') and data['distance'] > 0 and data['moving_time'] > 0:
                        # Pace in min/km
                        pace_seconds_per_meter = data['moving_time'] / data['distance']
                        data['avg_pace'] = pace_seconds_per_meter * 1000 / 60  # min/km
                    
                    # Calculate steps per minute from cadence
                    if data.get('avg_cadence'):
                        data['steps_per_minute'] = float(data['avg_cadence'])
                    
                    # Build INSERT query
                    columns = list(data.keys())
                    placeholders = ['%s'] * len(columns)
                    values = [data[col] for col in columns]
                    
                    insert_query = f"""
                    INSERT INTO garmin_activities ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                    ON CONFLICT (activity_id) DO UPDATE SET
                    {', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col != 'activity_id'])},
                    updated_at = NOW()
                    """
                    
                    pg_cursor.execute(insert_query, values)
                    migrated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    if error_count <= 5:  # Show first 5 errors
                        print(f"⚠️ Error processing activity: {e}")
                    continue
            
            # Commit batch
            pg_conn.commit()
            if migrated_count % batch_size == 0:
                print(f"📊 Processed {migrated_count} activities...")
        
        print(f"\n🎉 Migration completed!")
        print(f"✅ Successfully migrated: {migrated_count}")
        print(f"⚠️ Errors encountered: {error_count}")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate_activities()