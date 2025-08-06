#!/usr/bin/env python3
"""
Migrate activities data from garmin_activities.db to PostgreSQL
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

def check_garmin_activities_db():
    """Check structure of garmin_activities.db"""
    db_path = '../HealthData/DBs/garmin_activities.db'
    
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Tables in database: {tables}")
        
        # Check activities table structure
        if 'activities' in tables:
            cursor.execute("PRAGMA table_info(activities);")
            columns = cursor.fetchall()
            print(f"\nActivities table structure:")
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
            
            # Get sample data
            cursor.execute("SELECT COUNT(*) FROM activities;")
            count = cursor.fetchone()[0]
            print(f"\nTotal activities: {count}")
            
            if count > 0:
                # Get column names for sample query
                column_names = [col[1] for col in columns]
                cursor.execute(f"SELECT {', '.join(column_names[:15])} FROM activities LIMIT 3;")
                sample_data = cursor.fetchall()
                print(f"\nSample data (first 15 columns, 3 rows):")
                for i, row in enumerate(sample_data):
                    print(f"  Row {i+1}: {row}")
        
        conn.close()
        return tables
        
    except Exception as e:
        print(f"Error: {e}")
        return None

def create_activities_table():
    """Create comprehensive garmin_activities table"""
    
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
        elapsed_time INTEGER,
        moving_time INTEGER,
        distance FLOAT,
        
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
        avg_speed FLOAT,
        max_speed FLOAT,
        avg_pace FLOAT,
        
        -- Cadence
        avg_cadence FLOAT,
        max_cadence FLOAT,
        avg_running_cadence FLOAT,
        max_running_cadence FLOAT,
        
        -- Elevation
        ascent FLOAT,
        descent FLOAT,
        
        -- Running dynamics
        avg_step_length FLOAT,
        avg_vertical_ratio FLOAT,
        avg_vertical_oscillation FLOAT,
        avg_ground_contact_time FLOAT,
        avg_ground_contact_balance FLOAT,
        avg_stance_time FLOAT,
        avg_stance_time_balance FLOAT,
        
        -- Power metrics
        avg_power FLOAT,
        max_power FLOAT,
        normalized_power FLOAT,
        
        -- Temperature
        avg_temperature FLOAT,
        max_temperature FLOAT,
        min_temperature FLOAT,
        
        -- GPS coordinates
        start_lat FLOAT,
        start_long FLOAT,
        stop_lat FLOAT,
        stop_long FLOAT,
        
        -- Additional metrics
        cycles INTEGER,
        avg_rr FLOAT,
        max_rr FLOAT,
        steps INTEGER,
        strokes INTEGER,
        
        -- Training metrics
        training_stress_score FLOAT,
        intensity_factor FLOAT,
        vo2_max FLOAT,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_start_time ON garmin_activities(start_time);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_day ON garmin_activities(day);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_sport ON garmin_activities(sport);
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Creating garmin_activities table...")
        cursor.execute(create_table_sql)
        
        conn.commit()
        print("Activities table created successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error creating table: {e}")
        raise

def migrate_activities():
    """Migrate activities from SQLite to PostgreSQL"""
    
    # First check the source database
    tables = check_garmin_activities_db()
    if not tables or 'activities' not in tables:
        print("No activities table found in source database")
        return
    
    # Create the target table
    create_activities_table()
    
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
        print(f"\nAvailable columns in SQLite: {sqlite_columns}")
        
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
            'avg_rr': 'avg_rr',
            'max_rr': 'max_rr',
            'steps': 'steps',
            'strokes': 'strokes',
            'training_stress_score': 'training_stress_score',
            'intensity_factor': 'intensity_factor',
            'vo2_max': 'vo2_max'
        }
        
        # Find available columns
        available_columns = []
        for sqlite_col, pg_col in column_mapping.items():
            if sqlite_col in sqlite_columns:
                available_columns.append((sqlite_col, pg_col))
        
        print(f"\nMapped columns: {[col[0] for col in available_columns]}")
        
        # Build SELECT query
        select_cols = [col[0] for col in available_columns]
        select_query = f"SELECT {', '.join(select_cols)} FROM activities ORDER BY start_time"
        
        # Execute query
        sqlite_cursor.execute(select_query)
        
        migrated_count = 0
        error_count = 0
        
        while True:
            rows = sqlite_cursor.fetchmany(100)  # Process in batches
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
                                    data[pg_col] = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                            elif isinstance(value, (int, float)):
                                data[pg_col] = datetime.fromtimestamp(value)
                        else:
                            data[pg_col] = value
                    
                    # Calculate derived fields
                    if 'start_time' in data and data['start_time']:
                        data['day'] = data['start_time'].date()
                    
                    # Calculate pace if we have distance and time
                    if data.get('distance') and data.get('moving_time') and data['distance'] > 0 and data['moving_time'] > 0:
                        # Pace in min/km
                        pace_seconds_per_meter = data['moving_time'] / data['distance']
                        data['avg_pace'] = pace_seconds_per_meter * 1000 / 60  # min/km
                    
                    # Build INSERT query with ON CONFLICT
                    columns = list(data.keys())
                    placeholders = ['%s'] * len(columns)
                    values = [data[col] for col in columns]
                    
                    insert_query = f"""
                    INSERT INTO garmin_activities ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                    ON CONFLICT (activity_id) DO UPDATE SET
                    {', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col != 'activity_id'])}
                    """
                    
                    pg_cursor.execute(insert_query, values)
                    migrated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    print(f"Error processing row: {e}")
                    continue
            
            # Commit batch
            pg_conn.commit()
            print(f"Migrated {migrated_count} activities...")
        
        print(f"\nMigration completed!")
        print(f"Successfully migrated: {migrated_count}")
        print(f"Errors: {error_count}")
        
    except Exception as e:
        print(f"Migration error: {e}")
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate_activities()