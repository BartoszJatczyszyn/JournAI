#!/usr/bin/env python3
"""
Migrate activities data from garmin_activities.db to PostgreSQL
Extracts comprehensive activity data including sport type, timing, training metrics, running dynamics, etc.
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

def check_and_create_activities_table():
    """Create comprehensive garmin_activities table if it doesn't exist"""
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS garmin_activities (
        activity_id BIGINT PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        sport VARCHAR(100),
        sub_sport VARCHAR(100),
        start_time TIMESTAMP WITH TIME ZONE,
        stop_time TIMESTAMP WITH TIME ZONE,
        day DATE,
        
        -- Duration and distance
        elapsed_time INTEGER,           -- seconds
        moving_time INTEGER,            -- seconds
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
        min_hr INTEGER,
        
        -- Speed and pace
        avg_speed FLOAT,                -- m/s
        max_speed FLOAT,                -- m/s
        avg_pace FLOAT,                 -- min/km (calculated)
        
        -- Cadence (steps/min for running, rpm for cycling)
        avg_cadence FLOAT,
        max_cadence FLOAT,
        avg_running_cadence FLOAT,
        max_running_cadence FLOAT,
        
        -- Elevation
        ascent FLOAT,                   -- meters
        descent FLOAT,                  -- meters
        
        -- Running dynamics
        avg_step_length FLOAT,          -- meters
        avg_vertical_ratio FLOAT,       -- %
        avg_vertical_oscillation FLOAT, -- cm
        avg_ground_contact_time FLOAT,  -- ms
        avg_ground_contact_balance FLOAT, -- %
        avg_stance_time FLOAT,          -- ms
        avg_stance_time_balance FLOAT,  -- %
        
        -- Power metrics (cycling/running)
        avg_power FLOAT,                -- watts
        max_power FLOAT,                -- watts
        normalized_power FLOAT,         -- watts
        
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
        cycles INTEGER,                 -- total steps or strokes
        steps INTEGER,                  -- total steps
        strokes INTEGER,                -- total strokes
        avg_rr FLOAT,                   -- respiratory rate
        max_rr FLOAT,                   -- respiratory rate
        
        -- Training metrics
        training_stress_score FLOAT,
        intensity_factor FLOAT,
        vo2_max FLOAT,
        
        -- Derived metrics
        steps_per_minute FLOAT,         -- calculated from steps and time
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_start_time ON garmin_activities(start_time);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_day ON garmin_activities(day);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_sport ON garmin_activities(sport);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_sub_sport ON garmin_activities(sub_sport);
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔧 Creating/verifying garmin_activities table...")
        cursor.execute(create_table_sql)
        
        conn.commit()
        print("✅ Activities table ready!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        raise

def explore_garmin_activities_db():
    """Explore the structure of garmin_activities.db"""
    db_path = '../HealthData/DBs/garmin_activities.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"📊 Tables in garmin_activities.db: {tables}")
        
        # Check activities table structure
        if 'activities' in tables:
            cursor.execute("PRAGMA table_info(activities);")
            columns = cursor.fetchall()
            print(f"\n🏃 Activities table has {len(columns)} columns:")
            for col in columns:
                print(f"  • {col[1]} ({col[2]})")
            
            # Get sample data
            cursor.execute("SELECT COUNT(*) FROM activities;")
            count = cursor.fetchone()[0]
            print(f"\n📈 Total activities in database: {count}")
            
            if count > 0:
                # Show sample activity types
                cursor.execute("SELECT DISTINCT sport, sub_sport FROM activities WHERE sport IS NOT NULL LIMIT 10;")
                sports = cursor.fetchall()
                print(f"\n🏃 Activity types found:")
                for sport, sub_sport in sports:
                    print(f"  • {sport}" + (f" / {sub_sport}" if sub_sport else ""))
                
                # Show date range
                cursor.execute("SELECT MIN(start_time), MAX(start_time) FROM activities WHERE start_time IS NOT NULL;")
                date_range = cursor.fetchone()
                if date_range[0] and date_range[1]:
                    print(f"\n📅 Date range: {date_range[0]} to {date_range[1]}")
        
        conn.close()
        return tables
        
    except Exception as e:
        print(f"❌ Error exploring database: {e}")
        return None

def migrate_activities():
    """Migrate activities from SQLite to PostgreSQL with comprehensive data extraction"""
    
    print("🚀 Starting Garmin activities migration...")
    
    # First explore the source database
    tables = explore_garmin_activities_db()
    if not tables or 'activities' not in tables:
        print("❌ No activities table found in source database")
        return
    
    # Create the target table
    check_and_create_activities_table()
    
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
        print(f"\n📋 Available columns in source: {len(sqlite_columns)} columns")
        
        # Map SQLite columns to PostgreSQL columns
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
            'min_hr': 'min_hr',
            'avg_speed': 'avg_speed',
            'max_speed': 'max_speed',
            'avg_cadence': 'avg_cadence',
            'max_cadence': 'max_cadence',
            'avg_running_cadence': 'avg_running_cadence',
            'max_running_cadence': 'max_running_cadence',
            'ascent': 'ascent',
            'descent': 'descent',
            'avg_step_length': 'avg_step_length',
            'avg_vertical_ratio': 'avg_vertical_ratio',
            'avg_vertical_oscillation': 'avg_vertical_oscillation',
            'avg_ground_contact_time': 'avg_ground_contact_time',
            'avg_ground_contact_balance': 'avg_ground_contact_balance',
            'avg_stance_time': 'avg_stance_time',
            'avg_stance_time_balance': 'avg_stance_time_balance',
            'avg_power': 'avg_power',
            'max_power': 'max_power',
            'normalized_power': 'normalized_power',
            'avg_temperature': 'avg_temperature',
            'max_temperature': 'max_temperature',
            'min_temperature': 'min_temperature',
            'start_lat': 'start_lat',
            'start_long': 'start_long',
            'stop_lat': 'stop_lat',
            'stop_long': 'stop_long',
            'cycles': 'cycles',
            'steps': 'steps',
            'strokes': 'strokes',
            'avg_rr': 'avg_rr',
            'max_rr': 'max_rr',
            'training_stress_score': 'training_stress_score',
            'intensity_factor': 'intensity_factor',
            'vo2_max': 'vo2_max'
        }
        
        # Find available columns
        available_columns = []
        for sqlite_col, pg_col in column_mapping.items():
            if sqlite_col in sqlite_columns:
                available_columns.append((sqlite_col, pg_col))
        
        print(f"📊 Mapping {len(available_columns)} columns:")
        for sqlite_col, pg_col in available_columns[:10]:  # Show first 10
            print(f"  • {sqlite_col} → {pg_col}")
        if len(available_columns) > 10:
            print(f"  ... and {len(available_columns) - 10} more")
        
        # Check existing activities to avoid duplicates
        pg_cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
        existing_count = pg_cursor.fetchone()[0]
        print(f"\n📈 Existing activities in PostgreSQL: {existing_count}")
        
        # Build SELECT query
        select_cols = [col[0] for col in available_columns]
        select_query = f"SELECT {', '.join(select_cols)} FROM activities ORDER BY start_time"
        
        # Execute query
        print(f"\n🔄 Fetching activities from SQLite...")
        sqlite_cursor.execute(select_query)
        
        migrated_count = 0
        updated_count = 0
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
                                    # Try ISO format first
                                    data[pg_col] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                except:
                                    try:
                                        # Try standard format
                                        data[pg_col] = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                                    except:
                                        # Skip invalid timestamps
                                        data[pg_col] = None
                            elif isinstance(value, (int, float)):
                                try:
                                    data[pg_col] = datetime.fromtimestamp(value)
                                except:
                                    data[pg_col] = None
                            else:
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
                    
                    # Calculate steps per minute
                    if data.get('steps') and data.get('moving_time') and data['moving_time'] > 0:
                        data['steps_per_minute'] = (data['steps'] / data['moving_time']) * 60
                    
                    # Build INSERT query with ON CONFLICT
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
                    
                    # Check if it was an insert or update
                    if pg_cursor.rowcount > 0:
                        migrated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    print(f"⚠️ Error processing activity {row[0] if row else 'unknown'}: {e}")
                    continue
            
            # Commit batch
            pg_conn.commit()
            if migrated_count % batch_size == 0:
                print(f"📊 Processed {migrated_count} activities...")
        
        # Final summary
        pg_cursor.execute("SELECT COUNT(*) FROM garmin_activities;")
        final_count = pg_cursor.fetchone()[0]
        new_activities = final_count - existing_count
        
        print(f"\n🎉 Migration completed!")
        print(f"📈 Total activities in database: {final_count}")
        print(f"✅ New activities added: {new_activities}")
        print(f"⚠️ Errors encountered: {error_count}")
        
        # Show activity type summary
        pg_cursor.execute("""
            SELECT sport, COUNT(*) as count 
            FROM garmin_activities 
            WHERE sport IS NOT NULL 
            GROUP BY sport 
            ORDER BY count DESC 
            LIMIT 10
        """)
        sports_summary = pg_cursor.fetchall()
        
        print(f"\n🏃 Activity types in database:")
        for sport, count in sports_summary:
            print(f"  • {sport}: {count} activities")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate_activities()