#!/usr/bin/env python3
"""
Add activities table to database
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

def create_activities_table():
    """Create garmin_activities table"""
    
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
        
        -- Speed and pace
        avg_speed FLOAT,
        max_speed FLOAT,
        avg_pace FLOAT,
        
        -- Cadence
        avg_cadence FLOAT,
        max_cadence FLOAT,
        
        -- Elevation
        ascent FLOAT,
        descent FLOAT,
        
        -- Running dynamics
        avg_step_length FLOAT,
        avg_vertical_ratio FLOAT,
        avg_vertical_oscillation FLOAT,
        avg_ground_contact_time FLOAT,
        avg_ground_contact_balance FLOAT,
        
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
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_start_time ON garmin_activities(start_time);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_day ON garmin_activities(day);
    CREATE INDEX IF NOT EXISTS idx_garmin_activities_sport ON garmin_activities(sport);
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔧 Creating garmin_activities table...")
        cursor.execute(create_table_sql)
        
        conn.commit()
        print("✅ Activities table created successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        raise

if __name__ == "__main__":
    create_activities_table()