#!/usr/bin/env python3
"""
Garmin Data Migration Script
Migrates Garmin health data from SQLite/JSON to PostgreSQL with daily_journal table
"""

import sqlite3
import json
import os
import psycopg2
from datetime import datetime, date
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class DatabaseConfig:
    host: str = "localhost"
    port: int = 5432
    database: str = "garmin_health"
    username: str = "postgres"
    password: str = "your_password"

class GarminDataMigrator:
    def __init__(self, db_config: DatabaseConfig):
        self.db_config = db_config
        self.health_data_path = "HealthData"
        
    def connect_postgresql(self):
        """Connect to PostgreSQL database"""
        try:
            conn = psycopg2.connect(
                host=self.db_config.host,
                port=self.db_config.port,
                database=self.db_config.database,
                user=self.db_config.username,
                password=self.db_config.password
            )
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise

    def create_tables(self):
        """Create PostgreSQL tables"""
        conn = self.connect_postgresql()
        cursor = conn.cursor()
        
        try:
            # Create garmin_daily_summaries table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS garmin_daily_summaries (
                    day DATE PRIMARY KEY,
                    steps INTEGER,
                    distance_meters FLOAT,
                    calories_burned INTEGER,
                    active_calories INTEGER,
                    floors_climbed INTEGER,
                    stress_avg INTEGER,
                    body_battery_max INTEGER,
                    body_battery_min INTEGER,
                    body_battery_charged INTEGER,
                    body_battery_drained INTEGER,
                    resting_heart_rate INTEGER,
                    max_heart_rate INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create garmin_activities table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS garmin_activities (
                    activity_id BIGINT PRIMARY KEY,
                    day DATE,
                    activity_type VARCHAR(100),
                    activity_name VARCHAR(200),
                    start_time TIMESTAMP,
                    duration_seconds INTEGER,
                    distance_meters FLOAT,
                    calories INTEGER,
                    avg_heart_rate INTEGER,
                    max_heart_rate INTEGER,
                    avg_speed FLOAT,
                    max_speed FLOAT,
                    elevation_gain FLOAT,
                    elevation_loss FLOAT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create garmin_sleep_sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS garmin_sleep_sessions (
                    sleep_id BIGINT PRIMARY KEY,
                    day DATE,
                    sleep_start TIMESTAMP,
                    sleep_end TIMESTAMP,
                    sleep_duration_seconds INTEGER,
                    deep_sleep_seconds INTEGER,
                    light_sleep_seconds INTEGER,
                    rem_sleep_seconds INTEGER,
                    awake_seconds INTEGER,
                    nap_duration_seconds INTEGER,
                    sleep_score INTEGER,
                    sleep_quality VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create daily_journal table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_journal (
                    day DATE PRIMARY KEY REFERENCES garmin_daily_summaries(day),
                    location VARCHAR(200),
                    mood VARCHAR(100),
                    alcohol VARCHAR(100),
                    meditated BOOLEAN,
                    calories_controlled BOOLEAN,
                    sweet_cravings BOOLEAN,
                    night_snacking BOOLEAN,
                    notes TEXT,
                    
                    supplement_ashwagandha BOOLEAN DEFAULT FALSE,
                    supplement_magnesium BOOLEAN DEFAULT FALSE,
                    supplement_vitamin_d BOOLEAN DEFAULT FALSE,
                    supplements_taken VARCHAR(500),
                    
                    used_sleep_mask BOOLEAN,
                    used_ear_plugs BOOLEAN,
                    bedroom_temp_rating VARCHAR(50),
                    read_before_sleep BOOLEAN,
                    used_phone_before_sleep BOOLEAN,
                    hot_bath_before_sleep BOOLEAN,
                    
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create weight tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS garmin_weight (
                    day DATE PRIMARY KEY,
                    weight_grams FLOAT,
                    weight_kg FLOAT,
                    bmi FLOAT,
                    body_fat_percentage FLOAT,
                    muscle_mass_kg FLOAT,
                    bone_mass_kg FLOAT,
                    body_water_percentage FLOAT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            conn.commit()
            logger.info("Tables created successfully")
            
        except Exception as e:
            logger.error(f"Error creating tables: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def load_json_data(self, file_path: str) -> Optional[Dict[Any, Any]]:
        """Load JSON data from file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load {file_path}: {e}")
            return None

    def parse_date_from_filename(self, filename: str) -> Optional[date]:
        """Extract date from filename like 'sleep_2025-08-04.json'"""
        try:
            date_str = filename.split('_')[1].replace('.json', '')
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception as e:
            logger.warning(f"Could not parse date from {filename}: {e}")
            return None

    def migrate_sleep_data(self):
        """Migrate sleep data from JSON files"""
        conn = self.connect_postgresql()
        cursor = conn.cursor()
        
        sleep_dir = os.path.join(self.health_data_path, "Sleep")
        if not os.path.exists(sleep_dir):
            logger.warning("Sleep directory not found")
            return
            
        try:
            for filename in os.listdir(sleep_dir):
                if not filename.endswith('.json'):
                    continue
                    
                file_path = os.path.join(sleep_dir, filename)
                day = self.parse_date_from_filename(filename)
                if not day:
                    continue
                    
                data = self.load_json_data(file_path)
                if not data or 'dailySleepDTO' not in data:
                    continue
                    
                sleep_data = data['dailySleepDTO']
                
                # Convert timestamps to datetime objects
                sleep_start = None
                sleep_end = None
                if sleep_data.get('sleepStartTimestampLocal'):
                    sleep_start = datetime.fromtimestamp(sleep_data['sleepStartTimestampLocal'] / 1000)
                if sleep_data.get('sleepEndTimestampLocal'):
                    sleep_end = datetime.fromtimestamp(sleep_data['sleepEndTimestampLocal'] / 1000)
                
                cursor.execute("""
                    INSERT INTO garmin_sleep_sessions 
                    (sleep_id, day, sleep_start, sleep_end, sleep_duration_seconds, 
                     nap_duration_seconds, sleep_score)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (sleep_id) DO UPDATE SET
                        day = EXCLUDED.day,
                        sleep_start = EXCLUDED.sleep_start,
                        sleep_end = EXCLUDED.sleep_end,
                        sleep_duration_seconds = EXCLUDED.sleep_duration_seconds,
                        nap_duration_seconds = EXCLUDED.nap_duration_seconds,
                        sleep_score = EXCLUDED.sleep_score
                """, (
                    sleep_data.get('id'),
                    day,
                    sleep_start,
                    sleep_end,
                    sleep_data.get('sleepTimeSeconds'),
                    sleep_data.get('napTimeSeconds'),
                    sleep_data.get('sleepScores', {}).get('overall', {}).get('value') if sleep_data.get('sleepScores') else None
                ))
                
            conn.commit()
            logger.info("Sleep data migrated successfully")
            
        except Exception as e:
            logger.error(f"Error migrating sleep data: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def migrate_rhr_data(self):
        """Migrate resting heart rate data from JSON files"""
        conn = self.connect_postgresql()
        cursor = conn.cursor()
        
        rhr_dir = os.path.join(self.health_data_path, "RHR")
        if not os.path.exists(rhr_dir):
            logger.warning("RHR directory not found")
            return
            
        try:
            for filename in os.listdir(rhr_dir):
                if not filename.endswith('.json'):
                    continue
                    
                file_path = os.path.join(rhr_dir, filename)
                day = self.parse_date_from_filename(filename)
                if not day:
                    continue
                    
                data = self.load_json_data(file_path)
                if not data or 'allMetrics' not in data:
                    continue
                    
                metrics = data['allMetrics']['metricsMap']
                rhr_data = metrics.get('WELLNESS_RESTING_HEART_RATE', [])
                
                if rhr_data:
                    rhr_value = rhr_data[0].get('value')
                    
                    # Insert or update daily summary with RHR
                    cursor.execute("""
                        INSERT INTO garmin_daily_summaries (day, resting_heart_rate)
                        VALUES (%s, %s)
                        ON CONFLICT (day) DO UPDATE SET
                            resting_heart_rate = EXCLUDED.resting_heart_rate,
                            updated_at = CURRENT_TIMESTAMP
                    """, (day, int(rhr_value) if rhr_value else None))
                
            conn.commit()
            logger.info("RHR data migrated successfully")
            
        except Exception as e:
            logger.error(f"Error migrating RHR data: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def migrate_weight_data(self):
        """Migrate weight data from JSON files"""
        conn = self.connect_postgresql()
        cursor = conn.cursor()
        
        weight_dir = os.path.join(self.health_data_path, "Weight")
        if not os.path.exists(weight_dir):
            logger.warning("Weight directory not found")
            return
            
        try:
            for filename in os.listdir(weight_dir):
                if not filename.endswith('.json'):
                    continue
                    
                file_path = os.path.join(weight_dir, filename)
                day = self.parse_date_from_filename(filename)
                if not day:
                    continue
                    
                data = self.load_json_data(file_path)
                if not data or 'dateWeightList' not in data:
                    continue
                    
                weight_list = data['dateWeightList']
                if weight_list:
                    weight_data = weight_list[0]  # Take first measurement of the day
                    
                    weight_grams = weight_data.get('weight')
                    weight_kg = weight_grams / 1000 if weight_grams else None
                    
                    cursor.execute("""
                        INSERT INTO garmin_weight 
                        (day, weight_grams, weight_kg, bmi, body_fat_percentage)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (day) DO UPDATE SET
                            weight_grams = EXCLUDED.weight_grams,
                            weight_kg = EXCLUDED.weight_kg,
                            bmi = EXCLUDED.bmi,
                            body_fat_percentage = EXCLUDED.body_fat_percentage
                    """, (
                        day,
                        weight_grams,
                        weight_kg,
                        weight_data.get('bmi'),
                        weight_data.get('bodyFat')
                    ))
                
            conn.commit()
            logger.info("Weight data migrated successfully")
            
        except Exception as e:
            logger.error(f"Error migrating weight data: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def migrate_sqlite_data(self):
        """Migrate data from SQLite databases"""
        try:
            # Try to migrate from garmin_summary.db if it exists
            summary_db_path = os.path.join(self.health_data_path, "DBs", "garmin_summary.db")
            if os.path.exists(summary_db_path):
                self.migrate_from_summary_db(summary_db_path)
                
            # Try to migrate from garmin_activities.db if it exists  
            activities_db_path = os.path.join(self.health_data_path, "DBs", "garmin_activities.db")
            if os.path.exists(activities_db_path):
                self.migrate_from_activities_db(activities_db_path)
                
        except Exception as e:
            logger.error(f"Error migrating SQLite data: {e}")

    def migrate_from_summary_db(self, db_path: str):
        """Migrate daily summary data from SQLite"""
        sqlite_conn = sqlite3.connect(db_path)
        sqlite_cursor = sqlite_conn.cursor()
        
        pg_conn = self.connect_postgresql()
        pg_cursor = pg_conn.cursor()
        
        try:
            # Get table names to understand structure
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in sqlite_cursor.fetchall()]
            logger.info(f"Found tables in summary DB: {tables}")
            
            # This would need to be customized based on actual table structure
            # For now, we'll skip SQLite migration and focus on JSON data
            
        except Exception as e:
            logger.error(f"Error migrating from summary DB: {e}")
        finally:
            sqlite_cursor.close()
            sqlite_conn.close()
            pg_cursor.close()
            pg_conn.close()

    def migrate_from_activities_db(self, db_path: str):
        """Migrate activities data from SQLite"""
        # Similar structure to summary DB migration
        pass

    def create_sample_journal_entries(self):
        """Create sample daily journal entries for recent dates"""
        conn = self.connect_postgresql()
        cursor = conn.cursor()
        
        try:
            # Get recent dates from daily summaries
            cursor.execute("""
                SELECT day FROM garmin_daily_summaries 
                WHERE day >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY day DESC
                LIMIT 10
            """)
            
            recent_days = [row[0] for row in cursor.fetchall()]
            
            for day in recent_days:
                cursor.execute("""
                    INSERT INTO daily_journal (day)
                    VALUES (%s)
                    ON CONFLICT (day) DO NOTHING
                """, (day,))
            
            conn.commit()
            logger.info(f"Created journal entries for {len(recent_days)} recent days")
            
        except Exception as e:
            logger.error(f"Error creating sample journal entries: {e}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    def run_migration(self):
        """Run the complete migration process"""
        logger.info("Starting Garmin data migration...")
        
        try:
            # Create tables
            self.create_tables()
            
            # Migrate JSON data
            self.migrate_sleep_data()
            self.migrate_rhr_data()
            self.migrate_weight_data()
            
            # Try to migrate SQLite data
            self.migrate_sqlite_data()
            
            # Create sample journal entries
            self.create_sample_journal_entries()
            
            logger.info("Migration completed successfully!")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

def main():
    """Main function"""
    # Configure your PostgreSQL connection
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        database="garmin_health",
        username="postgres",
        password="your_password"  # Change this!
    )
    
    migrator = GarminDataMigrator(db_config)
    migrator.run_migration()

if __name__ == "__main__":
    main()