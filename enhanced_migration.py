#!/usr/bin/env python3
"""
Enhanced Garmin Data Migration Script with better error handling and SQLAlchemy ORM
"""

import os
import json
import sqlite3
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Dict, Any
import logging

# Third-party imports
from sqlalchemy import create_engine, Column, Integer, BigInteger, String, Float, Boolean, Date, DateTime, Text, ForeignKey, CheckConstraint, Index, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import insert
from dotenv import load_dotenv

# Load environment variables
load_dotenv('config.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# SQLAlchemy Base
Base = declarative_base()

class GarminDailySummary(Base):
    __tablename__ = 'garmin_daily_summaries'
    
    # Identity
    day = Column(Date, primary_key=True, index=True)
    
    # Activity totals
    steps = Column(Integer)
    distance_meters = Column(Float)
    floors_climbed = Column(Integer)
    
    # Calories
    calories_burned = Column(Integer)
    active_calories = Column(Integer)
    calories_bmr_avg = Column(Integer)
    calories_goal = Column(Integer)
    activities_calories = Column(Integer)
    
    # Heart rate metrics
    hr_min = Column(Integer)
    hr_avg = Column(Integer)
    hr_max = Column(Integer)
    resting_heart_rate = Column(Integer)
    rhr_min = Column(Integer)
    rhr_avg = Column(Integer)
    rhr_max = Column(Integer)
    inactive_hr_min = Column(Integer)
    inactive_hr_avg = Column(Integer)
    inactive_hr_max = Column(Integer)
    
    # Intensity/activity time
    intensity_time = Column(Integer)
    moderate_activity_time = Column(Integer)
    vigorous_activity_time = Column(Integer)
    activities_distance = Column(Float)
    
    # Health
    stress_avg = Column(Integer)
    spo2_min = Column(Integer)
    spo2_avg = Column(Float)
    rr_min = Column(Float)
    rr_waking_avg = Column(Float)
    rr_max = Column(Float)
    sweat_loss = Column(Float)
    sweat_loss_avg = Column(Float)
    
    # Body Battery
    body_battery_min = Column(Integer)
    body_battery_max = Column(Integer)
    body_battery_charged = Column(Integer)
    body_battery_drained = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    journal = relationship("DailyJournal", back_populates="daily_summary", uselist=False)

class GarminSleepSession(Base):
    __tablename__ = 'garmin_sleep_sessions'
    
    # Identity
    sleep_id = Column(BigInteger, primary_key=True)
    day = Column(Date, index=True)
    
    # Window
    sleep_start = Column(DateTime)
    sleep_end = Column(DateTime)
    
    # Durations summary
    sleep_duration_seconds = Column(Integer)
    nap_duration_seconds = Column(Integer)
    
    # Stage durations
    deep_sleep_seconds = Column(Integer)
    light_sleep_seconds = Column(Integer)
    rem_sleep_seconds = Column(Integer)
    awake_seconds = Column(Integer)
    
    # Scores/quality
    sleep_score = Column(Integer)
    sleep_quality = Column(String(50))
    
    # Oxygen/respiration
    avg_spo2 = Column(Float)
    lowest_spo2 = Column(Integer)
    highest_spo2 = Column(Integer)
    avg_respiration = Column(Float)
    
    # Other metrics
    avg_sleep_stress = Column(Float)
    awake_count = Column(Integer)
    
    # Sleep need
    sleep_need_baseline = Column(Integer)
    sleep_need_actual = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminWeight(Base):
    __tablename__ = 'garmin_weight'
    
    day = Column(Date, primary_key=True, index=True)
    weight_grams = Column(Float)
    weight_kg = Column(Float)
    bmi = Column(Float)
    body_fat_percentage = Column(Float)
    muscle_mass_kg = Column(Float)
    bone_mass_kg = Column(Float)
    body_water_percentage = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminStressData(Base):
    __tablename__ = 'garmin_stress_data'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, index=True)
    day = Column(Date, index=True)
    stress_level = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminHeartRateData(Base):
    __tablename__ = 'garmin_heart_rate_data'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, index=True)
    day = Column(Date, index=True)
    heart_rate = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminRespiratoryRateData(Base):
    __tablename__ = 'garmin_respiratory_rate_data'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, index=True)
    day = Column(Date, index=True)
    respiratory_rate = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminActivity(Base):
    __tablename__ = 'garmin_activities'
    
    activity_id = Column(BigInteger, primary_key=True)
    name = Column(String(255))
    description = Column(Text)
    sport = Column(String(100))
    sub_sport = Column(String(100))
    start_time = Column(DateTime, index=True)
    stop_time = Column(DateTime)
    day = Column(Date, index=True)
    
    # Duration and distance
    elapsed_time = Column(Integer)  # seconds
    moving_time = Column(Integer)   # seconds
    distance = Column(Float)        # meters
    
    # Performance metrics
    calories = Column(Integer)
    training_load = Column(Float)
    training_effect = Column(Float)
    anaerobic_training_effect = Column(Float)
    self_eval_feel = Column(Integer)
    self_eval_effort = Column(Integer)
    
    # Heart rate
    avg_hr = Column(Integer)
    max_hr = Column(Integer)
    
    # Speed and pace
    avg_speed = Column(Float)       # m/s
    max_speed = Column(Float)       # m/s
    avg_pace = Column(Float)        # min/km (calculated)
    max_pace = Column(Float)        # min/km (reported max pace)
    
    # Cadence
    avg_cadence = Column(Float)     # steps/min or rpm
    max_cadence = Column(Float)
    
    # Elevation
    ascent = Column(Float)          # meters
    descent = Column(Float)         # meters
    
    # Running dynamics
    avg_step_length = Column(Float)         # meters
    avg_vertical_ratio = Column(Float)      # %
    avg_vertical_oscillation = Column(Float) # cm
    avg_ground_contact_time = Column(Float)  # ms
    avg_ground_contact_balance = Column(Float) # %
    
    # Temperature
    avg_temperature = Column(Float)
    max_temperature = Column(Float)
    min_temperature = Column(Float)
    
    # GPS coordinates
    start_lat = Column(Float)
    start_long = Column(Float)
    stop_lat = Column(Float)
    stop_long = Column(Float)
    
    # Additional metrics
    cycles = Column(Integer)        # total steps or strokes
    avg_rr = Column(Float)         # respiratory rate
    max_rr = Column(Float)
    # steps/view derived metrics
    steps = Column(Integer)
    avg_steps_per_min = Column(Float)
    max_steps_per_min = Column(Float)
    vo2_max = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class DailyJournal(Base):
    __tablename__ = 'daily_journal'

    # Identity / linkage
    day = Column(Date, ForeignKey("garmin_daily_summaries.day"), primary_key=True, index=True, nullable=False)

    # Core subjective ratings (1-5)
    mood = Column(Integer, nullable=True, default=None)  # 1 (very low) .. 5 (great)
    stress_level = Column(Integer, nullable=True, default=None)  # perceived stress 1-5
    energy_level = Column(Integer, nullable=True, default=None)  # energy 1-5
    focus_level = Column(Integer, nullable=True, default=None)   # focus 1-5
    productivity_score = Column(Integer, nullable=True, default=None)  # productivity 1-5
    sleep_quality_rating = Column(Integer, nullable=True, default=None)  # subjective sleep quality 1-5
    soreness_level = Column(Integer, nullable=True, default=None)  # DOMS / soreness 1-5
    social_interactions_quality = Column(Integer, nullable=True, default=None)  # 1-5
    digestion_quality = Column(Integer, nullable=True, default=None)  # 1-5
    workout_intensity_rating = Column(Integer, nullable=True, default=None)  # 1-5 subjective

    # Lifestyle flags / behaviors
    meditated = Column(Boolean, default=False)
    alcohol = Column(String(100), default=None)  # details string ("0" / type / units)
    fasting_hours = Column(Float, default=0.0)  # e.g. 16.0
    calories_controlled = Column(Boolean, default=False)
    night_snacking = Column(Boolean, default=False)
    sweet_cravings = Column(Boolean, default=False)
    steps_goal_achieved = Column(Boolean, default=False)
    journaling_done = Column(Boolean, default=False)
    stretching_mobility_done = Column(Boolean, default=False)

    # Nutrition / intake
    water_intake_ml = Column(Integer, default=0)      # daily total
    caffeine_mg = Column(Integer, default=0)
    supplements_taken = Column(String(500), default=None)  # free-form list
    supplement_ashwagandha = Column(Boolean, default=False)
    supplement_magnesium = Column(Boolean, default=False)
    supplement_vitamin_d = Column(Boolean, default=False)

    # Sleep environment / pre-sleep habits
    used_sleep_mask = Column(Boolean, default=False)
    used_ear_plugs = Column(Boolean, default=False)
    bedroom_temp_rating = Column(String(50), default=None)  # e.g. "cool", "warm"
    read_before_sleep = Column(Boolean, default=False)
    used_phone_before_sleep = Column(Boolean, default=False)
    hot_bath_before_sleep = Column(Boolean, default=False)
    blue_light_blockers = Column(Boolean, default=False)

    # Time allocations / exposure
    screen_time_minutes = Column(Integer, default=0)
    outside_time_minutes = Column(Integer, default=0)
    reading_time_minutes = Column(Integer, default=0)

    # Body metrics (subjective or quick manual capture)
    weight_morning_kg = Column(Float, default=None)
    resting_hr_manual = Column(Integer, default=None)  # if user self-logs different from device
    hrv_ms = Column(Integer, default=None)  # manual HRV (rMSSD) entry in milliseconds

    # Context / qualitative
    location = Column(String(200), default=None)
    primary_workout_type = Column(String(100), default=None)
    notes = Column(Text, default=None)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    daily_summary = relationship("GarminDailySummary", back_populates="journal")

    # Constraints and indexes (PostgreSQL)
    __table_args__ = (
        # Rating scales 1-5 (allow NULL)
        CheckConstraint('(mood BETWEEN 1 AND 5) OR mood IS NULL', name='ck_daily_journal_mood_range'),
        CheckConstraint('(stress_level BETWEEN 1 AND 5) OR stress_level IS NULL', name='ck_dj_stress_level'),
        CheckConstraint('(energy_level BETWEEN 1 AND 5) OR energy_level IS NULL', name='ck_dj_energy_level'),
        CheckConstraint('(focus_level BETWEEN 1 AND 5) OR focus_level IS NULL', name='ck_dj_focus_level'),
        CheckConstraint('(productivity_score BETWEEN 1 AND 5) OR productivity_score IS NULL', name='ck_dj_productivity'),
        CheckConstraint('(sleep_quality_rating BETWEEN 1 AND 5) OR sleep_quality_rating IS NULL', name='ck_dj_sleep_quality'),
        CheckConstraint('(soreness_level BETWEEN 1 AND 5) OR soreness_level IS NULL', name='ck_dj_soreness'),
        CheckConstraint('(social_interactions_quality BETWEEN 1 AND 5) OR social_interactions_quality IS NULL', name='ck_dj_social_quality'),
        CheckConstraint('(digestion_quality BETWEEN 1 AND 5) OR digestion_quality IS NULL', name='ck_dj_digestion'),
        CheckConstraint('(workout_intensity_rating BETWEEN 1 AND 5) OR workout_intensity_rating IS NULL', name='ck_dj_workout_intensity'),
        # Quantitative ranges
        CheckConstraint('water_intake_ml IS NULL OR (water_intake_ml >= 0 AND water_intake_ml <= 15000)', name='ck_dj_water_intake'),
        CheckConstraint('caffeine_mg IS NULL OR (caffeine_mg >= 0 AND caffeine_mg <= 3000)', name='ck_dj_caffeine'),
        CheckConstraint('fasting_hours IS NULL OR (fasting_hours >= 0 AND fasting_hours <= 72)', name='ck_dj_fasting_hours'),
        CheckConstraint('screen_time_minutes IS NULL OR (screen_time_minutes >= 0 AND screen_time_minutes <= 2000)', name='ck_dj_screen_time'),
        CheckConstraint('outside_time_minutes IS NULL OR (outside_time_minutes >= 0 AND outside_time_minutes <= 1440)', name='ck_dj_outside_time'),
        CheckConstraint('reading_time_minutes IS NULL OR (reading_time_minutes >= 0 AND reading_time_minutes <= 1440)', name='ck_dj_reading_time'),
        CheckConstraint('hrv_ms IS NULL OR (hrv_ms >= 0 AND hrv_ms <= 400)', name='ck_dj_hrv_ms_range'),
        Index('ix_daily_journal_mood', 'mood'),
        Index('ix_daily_journal_energy_focus', 'energy_level', 'focus_level')
    )

    # --- Subjective rating fields (1-5) ---
    SUBJECTIVE_RATING_FIELDS = [
        'mood', 'stress_level', 'energy_level', 'focus_level', 'productivity_score',
        'sleep_quality_rating', 'soreness_level', 'social_interactions_quality',
        'digestion_quality', 'workout_intensity_rating'
    ]

    SUBJECTIVE_LABEL_MAP = {
        # Possible text -> numeric mappings (can be extended). Includes some Polish variants for convenience.
        'very bad': 1, 'bardzo zle': 1, 'zle': 2, 'bad': 2, 'ok': 3, 'neutral': 3,
        'good': 4, 'dobrze': 4, 'great': 5, 'super': 5, 'excellent': 5
    }

    def set_rating(self, field: str, value):
        """Set a subjective rating (1–5) for a given field.

        Accepts:
        - int 1–5
        - string containing a digit
        - textual label present in SUBJECTIVE_LABEL_MAP
        - None (clears the value)
        Returns True if handled (even if cleared), False if field unsupported.
        """
        if field not in self.SUBJECTIVE_RATING_FIELDS:
            return False
        if value is None:
            setattr(self, field, None)
            return True
        try:
            if isinstance(value, str):
                lower = value.strip().lower()
                if lower in self.SUBJECTIVE_LABEL_MAP:
                    num = self.SUBJECTIVE_LABEL_MAP[lower]
                else:
                    # try to parse a digit inside the string
                    num = int(''.join([c for c in lower if c.isdigit()])) if any(c.isdigit() for c in lower) else None
            elif isinstance(value, (int, float)):
                num = int(value)
            else:
                num = None
            if num is None:
                setattr(self, field, None)
                return True
            if num < 1:
                num = 1
            if num > 5:
                num = 5
            setattr(self, field, num)
            return True
        except Exception:
            setattr(self, field, None)
            return True

    @property
    def wellbeing_composite_score(self) -> float:
        """Return the average of available subjective ratings (ignores NULL).
        Can be used as a lightweight overall wellbeing indicator.
        """
        values = [getattr(self, f) for f in self.SUBJECTIVE_RATING_FIELDS if getattr(self, f) is not None]
        if not values:
            return 0.0
        return round(sum(values) / len(values), 2)

    def update_from_payload(self, payload: dict):
        """Update journal fields from a dict payload (e.g. API / form input).

        Defensive: ignores missing / unknown fields.
        Automatically applies mapping for subjective rating fields.
        """
        if not isinstance(payload, dict):
            return
        for key, val in payload.items():
            if key in self.SUBJECTIVE_RATING_FIELDS:
                self.set_rating(key, val)
            elif hasattr(self, key):
                setattr(self, key, val)

class EnhancedGarminMigrator:
    def __init__(self):
        self.health_data_path = Path(os.getenv('HEALTH_DATA_PATH', 'HealthData'))
        self.setup_database()
        
    def setup_database(self):
        """Setup database connection and create tables"""
        db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
        
        self.engine = create_engine(db_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Create all tables
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created/verified")
        # Apply post-creation schema adjustments (idempotent)
        self.apply_post_schema_updates()

    def apply_post_schema_updates(self):
        """Apply idempotent schema alterations for updated DailyJournal model.

        This handles:
        - Converting legacy mood (STRING) to INTEGER 1-5
        - Adding newly introduced columns if the table already existed
        - (Constraints will not be auto-added for existing tables without migrations; advanced users can run Alembic later.)
        """
        try:
            inspector = inspect(self.engine)
            if 'daily_journal' not in inspector.get_table_names():
                return

            # Map new columns (name -> SQL fragment) kept minimal for backward safety
            desired_columns = {
                'mood': 'INTEGER',
                'stress_level': 'INTEGER',
                'energy_level': 'INTEGER',
                'focus_level': 'INTEGER',
                'productivity_score': 'INTEGER',
                'sleep_quality_rating': 'INTEGER',
                'soreness_level': 'INTEGER',
                'social_interactions_quality': 'INTEGER',
                'digestion_quality': 'INTEGER',
                'workout_intensity_rating': 'INTEGER',
                'fasting_hours': 'DOUBLE PRECISION',
                'steps_goal_achieved': 'BOOLEAN',
                'journaling_done': 'BOOLEAN',
                'stretching_mobility_done': 'BOOLEAN',
                'water_intake_ml': 'INTEGER',
                'caffeine_mg': 'INTEGER',
                'screen_time_minutes': 'INTEGER',
                'outside_time_minutes': 'INTEGER',
                'reading_time_minutes': 'INTEGER',
                'weight_morning_kg': 'DOUBLE PRECISION',
                'resting_hr_manual': 'INTEGER',
                'hrv_ms': 'INTEGER',
                'primary_workout_type': 'VARCHAR(100)',
                'blue_light_blockers': 'BOOLEAN'
            }

            existing_columns_info = inspector.get_columns('daily_journal')
            existing_column_names = {c['name'] for c in existing_columns_info}

            with self.engine.begin() as conn:
                # Add any missing columns
                for col_name, col_sql in desired_columns.items():
                    if col_name not in existing_column_names:
                        try:
                            conn.execute(text(f'ALTER TABLE daily_journal ADD COLUMN {col_name} {col_sql}'))
                            logger.info(f"Added column daily_journal.{col_name}")
                        except Exception as e:
                            logger.warning(f"Could not add column {col_name}: {e}")

                # Convert legacy mood column type if needed (string -> int)
                for col in existing_columns_info:
                    if col['name'] == 'mood':
                        # Heuristic: if python_type not int, attempt conversion
                        try:
                            if hasattr(col['type'], 'python_type'):
                                python_type = col['type'].python_type
                            else:
                                python_type = None
                        except Exception:
                            python_type = None
                        if python_type is not int:
                            try:
                                # Attempt safe cast: extract digits; clamp to 1-5; invalid -> NULL
                                conn.execute(text(
                                    """
                                    ALTER TABLE daily_journal
                                    ALTER COLUMN mood TYPE INTEGER USING (
                                        CASE
                                            WHEN mood ~ '^[0-9]+' THEN LEAST(GREATEST((substring(mood from '^[0-9]+')::INTEGER),1),5)
                                            ELSE NULL
                                        END
                                    )
                                    """
                                ))
                                logger.info("Converted daily_journal.mood to INTEGER")
                            except Exception as e:
                                logger.warning(f"Could not convert mood column to INTEGER: {e}")
                        break

        except Exception as e:
            logger.warning(f"apply_post_schema_updates encountered an issue: {e}")

    def load_json_data(self, file_path: Path) -> Optional[Dict[Any, Any]]:
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

    def safe_timestamp_to_datetime(self, timestamp_ms: int) -> Optional[datetime]:
        """Safely convert timestamp to datetime with validation"""
        try:
            # Check if timestamp is reasonable (between 1970 and 2100)
            if timestamp_ms < 0 or timestamp_ms > 4102444800000:  # Year 2100
                logger.warning(f"Invalid timestamp: {timestamp_ms}")
                return None
            
            return datetime.fromtimestamp(timestamp_ms / 1000)
        except (ValueError, OSError, OverflowError) as e:
            logger.warning(f"Invalid timestamp {timestamp_ms}: {e}")
            return None

    def safe_int_conversion(self, value: Any, max_value: int = 2147483647) -> Optional[int]:
        """Safely convert value to integer with range checking"""
        try:
            if value is None:
                return None
            
            int_value = int(value)
            
            # Check if value fits in PostgreSQL INTEGER range
            if int_value > max_value or int_value < -2147483648:
                logger.warning(f"Integer value {int_value} out of range, skipping")
                return None
                
            return int_value
        except (ValueError, TypeError):
            return None

    def migrate_sleep_data(self):
        """Migrate sleep data from JSON files with improved error handling"""
        sleep_dir = self.health_data_path / "Sleep"
        if not sleep_dir.exists():
            logger.warning("Sleep directory not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        error_count = 0
        
        try:
            for file_path in sleep_dir.glob("*.json"):
                try:
                    day = self.parse_date_from_filename(file_path.name)
                    if not day:
                        continue
                        
                    data = self.load_json_data(file_path)
                    if not data or 'dailySleepDTO' not in data:
                        continue
                        
                    sleep_data = data['dailySleepDTO']
                    
                    # Safely convert sleep_id to BigInteger
                    sleep_id = sleep_data.get('id')
                    if sleep_id is None:
                        logger.warning(f"No sleep ID found for {day}")
                        continue
                    
                    # Convert timestamps safely
                    sleep_start = None
                    sleep_end = None
                    if sleep_data.get('sleepStartTimestampLocal'):
                        sleep_start = self.safe_timestamp_to_datetime(sleep_data['sleepStartTimestampLocal'])
                    if sleep_data.get('sleepEndTimestampLocal'):
                        sleep_end = self.safe_timestamp_to_datetime(sleep_data['sleepEndTimestampLocal'])
                    
                    # Safely convert duration values
                    sleep_duration = self.safe_int_conversion(sleep_data.get('sleepTimeSeconds'))
                    nap_duration = self.safe_int_conversion(sleep_data.get('napTimeSeconds'))
                    
                    # Extract sleep score safely
                    sleep_score = None
                    if sleep_data.get('sleepScores'):
                        overall_score = sleep_data['sleepScores'].get('overall', {})
                        if overall_score and 'value' in overall_score:
                            sleep_score = self.safe_int_conversion(overall_score['value'])
                    
                    # Extract detailed sleep stage data
                    deep_sleep = self.safe_int_conversion(sleep_data.get('deepSleepSeconds'))
                    light_sleep = self.safe_int_conversion(sleep_data.get('lightSleepSeconds'))
                    rem_sleep = self.safe_int_conversion(sleep_data.get('remSleepSeconds'))
                    awake_sleep = self.safe_int_conversion(sleep_data.get('awakeSleepSeconds'))
                    
                    # Extract additional sleep metrics
                    avg_sleep_stress = sleep_data.get('avgSleepStress')
                    avg_spo2 = sleep_data.get('averageSpO2Value')
                    lowest_spo2 = self.safe_int_conversion(sleep_data.get('lowestSpO2Value'))
                    highest_spo2 = self.safe_int_conversion(sleep_data.get('highestSpO2Value'))
                    avg_respiration = sleep_data.get('averageRespirationValue')
                    awake_count = self.safe_int_conversion(sleep_data.get('awakeCount'))
                    
                    # Extract sleep need data
                    sleep_need_baseline = None
                    sleep_need_actual = None
                    if sleep_data.get('sleepNeed'):
                        sleep_need_baseline = self.safe_int_conversion(sleep_data['sleepNeed'].get('baseline'))
                        sleep_need_actual = self.safe_int_conversion(sleep_data['sleepNeed'].get('actual'))
                    
                    # Use upsert to handle duplicates
                    stmt = insert(GarminSleepSession).values(
                        sleep_id=sleep_id,
                        day=day,
                        sleep_start=sleep_start,
                        sleep_end=sleep_end,
                        sleep_duration_seconds=sleep_duration,
                        deep_sleep_seconds=deep_sleep,
                        light_sleep_seconds=light_sleep,
                        rem_sleep_seconds=rem_sleep,
                        awake_seconds=awake_sleep,
                        nap_duration_seconds=nap_duration,
                        sleep_score=sleep_score,
                        avg_sleep_stress=avg_sleep_stress,
                        avg_spo2=avg_spo2,
                        lowest_spo2=lowest_spo2,
                        highest_spo2=highest_spo2,
                        avg_respiration=avg_respiration,
                        awake_count=awake_count,
                        sleep_need_baseline=sleep_need_baseline,
                        sleep_need_actual=sleep_need_actual
                    )
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['sleep_id'],
                        set_=dict(
                            day=stmt.excluded.day,
                            sleep_start=stmt.excluded.sleep_start,
                            sleep_end=stmt.excluded.sleep_end,
                            sleep_duration_seconds=stmt.excluded.sleep_duration_seconds,
                            deep_sleep_seconds=stmt.excluded.deep_sleep_seconds,
                            light_sleep_seconds=stmt.excluded.light_sleep_seconds,
                            rem_sleep_seconds=stmt.excluded.rem_sleep_seconds,
                            awake_seconds=stmt.excluded.awake_seconds,
                            nap_duration_seconds=stmt.excluded.nap_duration_seconds,
                            sleep_score=stmt.excluded.sleep_score,
                            avg_sleep_stress=stmt.excluded.avg_sleep_stress,
                            avg_spo2=stmt.excluded.avg_spo2,
                            lowest_spo2=stmt.excluded.lowest_spo2,
                            highest_spo2=stmt.excluded.highest_spo2,
                            avg_respiration=stmt.excluded.avg_respiration,
                            awake_count=stmt.excluded.awake_count,
                            sleep_need_baseline=stmt.excluded.sleep_need_baseline,
                            sleep_need_actual=stmt.excluded.sleep_need_actual
                        )
                    )
                    session.execute(stmt)
                    migrated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error processing sleep file {file_path}: {e}")
                    continue
                
            session.commit()
            logger.info(f"Migrated {migrated_count} sleep records ({error_count} errors)")
            
        except Exception as e:
            logger.error(f"Error migrating sleep data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_rhr_data(self):
        """Migrate resting heart rate data with improved error handling"""
        rhr_dir = self.health_data_path / "RHR"
        if not rhr_dir.exists():
            logger.warning("RHR directory not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        error_count = 0
        
        try:
            for file_path in rhr_dir.glob("*.json"):
                try:
                    day = self.parse_date_from_filename(file_path.name)
                    if not day:
                        continue
                        
                    data = self.load_json_data(file_path)
                    if not data or 'allMetrics' not in data:
                        continue
                        
                    metrics = data['allMetrics']['metricsMap']
                    rhr_data = metrics.get('WELLNESS_RESTING_HEART_RATE', [])
                    
                    if rhr_data:
                        rhr_value = self.safe_int_conversion(rhr_data[0].get('value'))
                        
                        if rhr_value is not None:
                            # Upsert daily summary with RHR
                            stmt = insert(GarminDailySummary).values(
                                day=day,
                                resting_heart_rate=rhr_value
                            )
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['day'],
                                set_=dict(
                                    resting_heart_rate=stmt.excluded.resting_heart_rate,
                                    updated_at=datetime.utcnow()
                                )
                            )
                            session.execute(stmt)
                            migrated_count += 1
                        
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error processing RHR file {file_path}: {e}")
                    continue
                
            session.commit()
            logger.info(f"Migrated {migrated_count} RHR records ({error_count} errors)")
            
        except Exception as e:
            logger.error(f"Error migrating RHR data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_daily_summary_data(self):
        """Migrate comprehensive daily summary data from garmin.db"""
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not garmin_db_path.exists():
            logger.warning("Garmin database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Connect to SQLite garmin database
            sqlite_conn = sqlite3.connect(str(garmin_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if daily_summary table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_summary'")
            if not sqlite_cursor.fetchone():
                logger.warning("daily_summary table not found in garmin database")
                sqlite_conn.close()
                return
            
            # Get all available columns
            sqlite_cursor.execute('PRAGMA table_info(daily_summary)')
            available_columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in daily_summary: {available_columns}")
            
            # Map database columns to our model fields based on garmin.db structure
            column_mapping = {
                'day': 'day',
                'steps': 'steps',
                'distance': 'distance_meters',
                'calories_total': 'calories_burned',
                'calories_active': 'active_calories',
                'calories_bmr': 'calories_bmr_avg',
                'calories_goal': 'calories_goal',
                'floors_climbed': 'floors_climbed',
                'hr_avg': 'hr_avg',
                'hr_min': 'hr_min', 
                'hr_max': 'hr_max',
                'max_heart_rate': 'hr_max',
                'rhr_avg': 'rhr_avg',
                'resting_heart_rate': 'resting_heart_rate',
                'rhr_min': 'rhr_min',
                'rhr_max': 'rhr_max',
                'inactive_hr_avg': 'inactive_hr_avg',
                'inactive_hr_min': 'inactive_hr_min',
                'inactive_hr_max': 'inactive_hr_max',
                'intensity_time': 'intensity_time',
                'moderate_activity_time': 'moderate_activity_time',
                'vigorous_activity_time': 'vigorous_activity_time',
                'activities_calories': 'activities_calories',
                'activities_distance': 'activities_distance',
                'stress_avg': 'stress_avg',
                'spo2_avg': 'spo2_avg',
                'spo2_min': 'spo2_min',
                'rr_waking_avg': 'rr_waking_avg',
                'rr_max': 'rr_max',
                'rr_min': 'rr_min',
                'sweat_loss_avg': 'sweat_loss_avg',
                'sweat_loss': 'sweat_loss',
                
                'bb_charged': 'body_battery_charged',
                'body_battery_max': 'body_battery_max',
                'body_battery_min': 'body_battery_min',
                'body_battery_charged': 'body_battery_charged',
                'body_battery_drained': 'body_battery_drained'
            }
            
            # Build query with available columns
            select_columns = []
            for db_col, model_field in column_mapping.items():
                if db_col in available_columns:
                    select_columns.append(db_col)
            
            if not select_columns:
                logger.warning("No matching columns found in daily_summary")
                sqlite_conn.close()
                return
            
            # Query data
            query = f"SELECT {', '.join(select_columns)} FROM daily_summary WHERE day IS NOT NULL"
            sqlite_cursor.execute(query)
            
            for row in sqlite_cursor.fetchall():
                try:
                    # Create data dict
                    data = {}
                    for i, col_name in enumerate(select_columns):
                        model_field = column_mapping[col_name]
                        value = row[i]
                        
                        # Convert data types
                        if col_name == 'day':
                            if isinstance(value, str):
                                data[model_field] = datetime.strptime(value, '%Y-%m-%d').date()
                            else:
                                continue
                        elif 'distance' in col_name or 'spo2' in col_name or 'rr_' in col_name or 'sweat' in col_name:
                            data[model_field] = float(value) if value is not None else None
                        else:
                            data[model_field] = self.safe_int_conversion(value)
                    
                    if 'day' not in data:
                        continue
                    
                    # Upsert daily summary
                    stmt = insert(GarminDailySummary).values(**data)
                    
                    # Build conflict resolution
                    update_dict = {k: getattr(stmt.excluded, k) for k in data.keys() if k != 'day'}
                    update_dict['updated_at'] = datetime.utcnow()
                    
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['day'],
                        set_=update_dict
                    )
                    session.execute(stmt)
                    migrated_count += 1
                    
                except Exception as e:
                    logger.warning(f"Error processing daily summary row: {e}")
                    continue
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} daily summary records")
            
        except Exception as e:
            logger.error(f"Error migrating daily summary data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_stress_data(self):
        """Migrate minute-by-minute stress data from garmin.db"""
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not garmin_db_path.exists():
            logger.warning("Garmin database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Connect to SQLite garmin database
            sqlite_conn = sqlite3.connect(str(garmin_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if stress table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stress'")
            if not sqlite_cursor.fetchone():
                logger.warning("stress table not found in garmin database")
                sqlite_conn.close()
                return
            
            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(stress)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in stress table: {columns}")
            
            # Look for timestamp and stress level columns
            timestamp_col = None
            stress_col = None
            
            for col in columns:
                if 'timestamp' in col.lower() or 'time' in col.lower():
                    timestamp_col = col
                if 'stress' in col.lower() and 'level' in col.lower():
                    stress_col = col
                elif 'stress' in col.lower() and timestamp_col:  # fallback to any stress column
                    stress_col = col
            
            if not timestamp_col or not stress_col:
                logger.warning(f"Required columns not found. Available: {columns}")
                sqlite_conn.close()
                return
            
            logger.info(f"Using columns: timestamp={timestamp_col}, stress={stress_col}")
            
            # Query stress data
            query = f"SELECT {timestamp_col}, {stress_col} FROM stress WHERE {stress_col} IS NOT NULL ORDER BY {timestamp_col}"
            sqlite_cursor.execute(query)
            
            for row in sqlite_cursor.fetchall():
                try:
                    timestamp_value, stress_value = row
                    
                    # Convert timestamp to datetime
                    if isinstance(timestamp_value, (int, float)):
                        # Unix timestamp (seconds or milliseconds)
                        if timestamp_value > 1e10:  # milliseconds
                            dt = datetime.fromtimestamp(timestamp_value / 1000)
                        else:  # seconds
                            dt = datetime.fromtimestamp(timestamp_value)
                    elif isinstance(timestamp_value, str):
                        # String timestamp
                        try:
                            dt = datetime.fromisoformat(timestamp_value.replace('Z', '+00:00'))
                        except:
                            dt = datetime.strptime(timestamp_value, '%Y-%m-%d %H:%M:%S')
                    else:
                        continue
                    
                    # Extract day
                    day = dt.date()
                    
                    # Convert stress value
                    stress_level = self.safe_int_conversion(stress_value)
                    if stress_level is None:
                        continue
                    
                    # Upsert stress data
                    stmt = insert(GarminStressData).values(
                        timestamp=dt,
                        day=day,
                        stress_level=stress_level
                    )
                    stmt = stmt.on_conflict_do_nothing()  # Avoid duplicates
                    session.execute(stmt)
                    migrated_count += 1
                    
                    # Commit in batches
                    if migrated_count % 1000 == 0:
                        session.commit()
                        logger.info(f"Migrated {migrated_count} stress records...")
                    
                except Exception as e:
                    logger.warning(f"Error processing stress row {row}: {e}")
                    continue
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} stress records")
            
        except Exception as e:
            logger.error(f"Error migrating stress data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_heart_rate_data(self):
        """Migrate minute-by-minute heart rate data from garmin_monitoring.db"""
        monitoring_db_path = self.health_data_path / "DBs" / "garmin_monitoring.db"
        if not monitoring_db_path.exists():
            logger.warning("Garmin monitoring database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Connect to SQLite monitoring database
            sqlite_conn = sqlite3.connect(str(monitoring_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if monitoring_hr table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monitoring_hr'")
            if not sqlite_cursor.fetchone():
                logger.warning("monitoring_hr table not found in garmin_monitoring database")
                sqlite_conn.close()
                return
            
            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(monitoring_hr)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in monitoring_hr table: {columns}")
            
            # Look for timestamp and heart rate columns
            timestamp_col = None
            hr_col = None
            
            for col in columns:
                if 'timestamp' in col.lower() or 'time' in col.lower():
                    timestamp_col = col
                if 'hr' in col.lower() or 'heart' in col.lower():
                    hr_col = col
                elif col.lower() in ['rate', 'bpm']:  # fallback names
                    hr_col = col
            
            if not timestamp_col or not hr_col:
                logger.warning(f"Required columns not found. Available: {columns}")
                sqlite_conn.close()
                return
            
            logger.info(f"Using columns: timestamp={timestamp_col}, heart_rate={hr_col}")
            
            # Query heart rate data
            query = f"SELECT {timestamp_col}, {hr_col} FROM monitoring_hr WHERE {hr_col} IS NOT NULL AND {hr_col} > 0 ORDER BY {timestamp_col}"
            sqlite_cursor.execute(query)
            
            for row in sqlite_cursor.fetchall():
                try:
                    timestamp_value, hr_value = row
                    
                    # Convert timestamp to datetime
                    if isinstance(timestamp_value, (int, float)):
                        # Unix timestamp (seconds or milliseconds)
                        if timestamp_value > 1e10:  # milliseconds
                            dt = datetime.fromtimestamp(timestamp_value / 1000)
                        else:  # seconds
                            dt = datetime.fromtimestamp(timestamp_value)
                    elif isinstance(timestamp_value, str):
                        # String timestamp
                        try:
                            dt = datetime.fromisoformat(timestamp_value.replace('Z', '+00:00'))
                        except:
                            dt = datetime.strptime(timestamp_value, '%Y-%m-%d %H:%M:%S')
                    else:
                        continue
                    
                    # Extract day
                    day = dt.date()
                    
                    # Convert heart rate value
                    heart_rate = self.safe_int_conversion(hr_value)
                    if heart_rate is None or heart_rate <= 0:
                        continue
                    
                    # Upsert heart rate data
                    stmt = insert(GarminHeartRateData).values(
                        timestamp=dt,
                        day=day,
                        heart_rate=heart_rate
                    )
                    stmt = stmt.on_conflict_do_nothing()  # Avoid duplicates
                    session.execute(stmt)
                    migrated_count += 1
                    
                    # Commit in batches
                    if migrated_count % 1000 == 0:
                        session.commit()
                        logger.info(f"Migrated {migrated_count} heart rate records...")
                    
                except Exception as e:
                    logger.warning(f"Error processing heart rate row {row}: {e}")
                    continue
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} heart rate records")
            
        except Exception as e:
            logger.error(f"Error migrating heart rate data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_respiratory_rate_data(self):
        """Migrate minute-by-minute respiratory rate data from garmin_monitoring.db"""
        monitoring_db_path = self.health_data_path / "DBs" / "garmin_monitoring.db"
        if not monitoring_db_path.exists():
            logger.warning("Garmin monitoring database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Connect to SQLite monitoring database
            sqlite_conn = sqlite3.connect(str(monitoring_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if monitoring_rr table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monitoring_rr'")
            if not sqlite_cursor.fetchone():
                logger.warning("monitoring_rr table not found in garmin_monitoring database")
                sqlite_conn.close()
                return
            
            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(monitoring_rr)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in monitoring_rr table: {columns}")
            
            # Look for timestamp and respiratory rate columns
            timestamp_col = None
            rr_col = None
            
            for col in columns:
                if 'timestamp' in col.lower() or 'time' in col.lower():
                    timestamp_col = col
                if 'rr' in col.lower() or 'respiratory' in col.lower() or 'respiration' in col.lower():
                    rr_col = col
                elif col.lower() in ['rate', 'breathing']:  # fallback names
                    rr_col = col
            
            if not timestamp_col or not rr_col:
                logger.warning(f"Required columns not found. Available: {columns}")
                sqlite_conn.close()
                return
            
            logger.info(f"Using columns: timestamp={timestamp_col}, respiratory_rate={rr_col}")
            
            # Query respiratory rate data
            query = f"SELECT {timestamp_col}, {rr_col} FROM monitoring_rr WHERE {rr_col} IS NOT NULL AND {rr_col} > 0 ORDER BY {timestamp_col}"
            sqlite_cursor.execute(query)
            
            for row in sqlite_cursor.fetchall():
                try:
                    timestamp_value, rr_value = row
                    
                    # Convert timestamp to datetime
                    if isinstance(timestamp_value, (int, float)):
                        # Unix timestamp (seconds or milliseconds)
                        if timestamp_value > 1e10:  # milliseconds
                            dt = datetime.fromtimestamp(timestamp_value / 1000)
                        else:  # seconds
                            dt = datetime.fromtimestamp(timestamp_value)
                    elif isinstance(timestamp_value, str):
                        # String timestamp
                        try:
                            dt = datetime.fromisoformat(timestamp_value.replace('Z', '+00:00'))
                        except:
                            dt = datetime.strptime(timestamp_value, '%Y-%m-%d %H:%M:%S')
                    else:
                        continue
                    
                    # Extract day
                    day = dt.date()
                    
                    # Convert respiratory rate value
                    respiratory_rate = float(rr_value) if rr_value is not None else None
                    if respiratory_rate is None or respiratory_rate <= 0:
                        continue
                    
                    # Upsert respiratory rate data
                    stmt = insert(GarminRespiratoryRateData).values(
                        timestamp=dt,
                        day=day,
                        respiratory_rate=respiratory_rate
                    )
                    stmt = stmt.on_conflict_do_nothing()  # Avoid duplicates
                    session.execute(stmt)
                    migrated_count += 1
                    
                    # Commit in batches
                    if migrated_count % 1000 == 0:
                        session.commit()
                        logger.info(f"Migrated {migrated_count} respiratory rate records...")
                    
                except Exception as e:
                    logger.warning(f"Error processing respiratory rate row {row}: {e}")
                    continue
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} respiratory rate records")
            
        except Exception as e:
            logger.error(f"Error migrating respiratory rate data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_activities_data(self):
        """Migrate detailed activity data from garmin_activities.db"""
        activities_db_path = self.health_data_path / "DBs" / "garmin_activities.db"
        if not activities_db_path.exists():
            logger.warning("Garmin activities database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Connect to SQLite activities database
            sqlite_conn = sqlite3.connect(str(activities_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if activities table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'")
            if not sqlite_cursor.fetchone():
                logger.warning("activities table not found in garmin_activities database")
                sqlite_conn.close()
                return
            
            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(activities)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in activities table: {columns}")
            
            # Map database columns to our model fields
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
                'avg_step_length': 'avg_step_length',
                'avg_vertical_ratio': 'avg_vertical_ratio',
                'avg_vertical_oscillation': 'avg_vertical_oscillation',
                'avg_ground_contact_time': 'avg_ground_contact_time',
                'avg_ground_contact_balance': 'avg_ground_contact_balance',
                'avg_temperature': 'avg_temperature',
                'max_temperature': 'max_temperature',
                'min_temperature': 'min_temperature',
                'start_lat': 'start_lat',
                'start_long': 'start_long',
                'stop_lat': 'stop_lat',
                'stop_long': 'stop_long',
                'cycles': 'cycles',
                'avg_rr': 'avg_rr',
                'max_rr': 'max_rr'
            }
            
            # Build query with available columns
            select_columns = []
            for db_col, model_field in column_mapping.items():
                if db_col in columns:
                    select_columns.append(db_col)
            
            if not select_columns:
                logger.warning("No matching columns found in activities")
                sqlite_conn.close()
                return
            
            logger.info(f"Using columns: {select_columns}")

            # --- NEW: Preload steps / steps-per-min metrics from steps_activities_view if available ---
            steps_metrics = {}
            try:
                sqlite_cursor.execute("SELECT name, type FROM sqlite_master WHERE (type='view' OR type='table') AND name='steps_activities_view'")
                if sqlite_cursor.fetchone():
                    sqlite_cursor.execute("PRAGMA table_info(steps_activities_view)")
                    steps_view_cols = [c[1] for c in sqlite_cursor.fetchall()]
                    wanted_cols = []
                    # Determine available metric columns
                    has_steps = 'steps' in steps_view_cols
                    has_avg_spm = 'avg_steps_per_min' in steps_view_cols
                    has_max_spm = 'max_steps_per_min' in steps_view_cols
                    if has_steps: wanted_cols.append('steps')
                    if has_avg_spm: wanted_cols.append('avg_steps_per_min')
                    if has_max_spm: wanted_cols.append('max_steps_per_min')
                    if 'activity_id' not in steps_view_cols:
                        logger.warning("steps_activities_view lacks activity_id column — cannot map metrics")
                    elif wanted_cols:
                        cols_sql = ', '.join(['activity_id'] + wanted_cols)
                        sqlite_cursor.execute(f"SELECT {cols_sql} FROM steps_activities_view WHERE activity_id IS NOT NULL")
                        for row in sqlite_cursor.fetchall():
                            activity_id = row[0]
                            metrics = {}
                            idx = 1
                            if has_steps:
                                metrics['steps'] = int(row[idx]) if row[idx] is not None else None; idx += 1
                            if has_avg_spm:
                                metrics['avg_steps_per_min'] = float(row[idx]) if row[idx] is not None else None; idx += 1
                            if has_max_spm:
                                metrics['max_steps_per_min'] = float(row[idx]) if row[idx] is not None else None; idx += 1
                            steps_metrics[activity_id] = metrics
                        logger.info(f"Loaded steps metrics for {len(steps_metrics)} activities from steps_activities_view (cols: {wanted_cols})")
                    else:
                        logger.info("steps_activities_view found but no target metric columns present")
                else:
                    logger.info("steps_activities_view not found — skipping steps/min metrics preload")
            except Exception as e:
                logger.warning(f"Could not load steps metrics from steps_activities_view: {e}")
            
            # Query activities data
            query = f"SELECT {', '.join(select_columns)} FROM activities WHERE activity_id IS NOT NULL ORDER BY start_time"
            sqlite_cursor.execute(query)
            
            for row in sqlite_cursor.fetchall():
                try:
                    # Create data dict
                    data = {}
                    for i, col_name in enumerate(select_columns):
                        model_field = column_mapping[col_name]
                        value = row[i]
                        
                        # Convert data types
                        if col_name in ['start_time', 'stop_time']:
                            if isinstance(value, str):
                                try:
                                    data[model_field] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                except:
                                    data[model_field] = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                            elif isinstance(value, (int, float)):
                                data[model_field] = datetime.fromtimestamp(value)
                        elif col_name in ['distance', 'avg_speed', 'max_speed', 'training_load', 'training_effect', 
                                        'anaerobic_training_effect', 'avg_cadence', 'max_cadence', 'ascent', 'descent',
                                        'avg_step_length', 'avg_vertical_ratio', 'avg_vertical_oscillation', 
                                        'avg_ground_contact_time', 'avg_ground_contact_balance', 'avg_temperature',
                                        'max_temperature', 'min_temperature', 'start_lat', 'start_long', 
                                        'stop_lat', 'stop_long', 'avg_rr', 'max_rr']:
                            data[model_field] = float(value) if value is not None else None
                        elif col_name in ['activity_id', 'elapsed_time', 'moving_time', 'calories', 'self_eval_feel',
                                        'self_eval_effort', 'avg_hr', 'max_hr', 'cycles']:
                            data[model_field] = self.safe_int_conversion(value)
                        else:
                            data[model_field] = value
                    
                    if 'activity_id' not in data or data['activity_id'] is None:
                        continue
                    
                    # Calculate derived fields
                    if 'start_time' in data and data['start_time']:
                        data['day'] = data['start_time'].date()
                    
                    # Calculate pace if we have distance and time
                    if data.get('distance') and data.get('moving_time') and data['distance'] > 0 and data['moving_time'] > 0:
                        # Pace in min/km
                        pace_seconds_per_meter = data['moving_time'] / data['distance']
                        data['avg_pace'] = pace_seconds_per_meter * 1000 / 60  # min/km

                    # Merge in steps metrics if present and not already supplied by activities table
                    sid = data.get('activity_id')
                    if sid in steps_metrics:
                        sm = steps_metrics[sid]
                        # Only set if key absent or None to not overwrite future extension
                        for k, v in sm.items():
                            if v is not None and (k not in data or data[k] is None):
                                data[k] = v
                    
                    # Upsert activity
                    stmt = insert(GarminActivity).values(**data)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['activity_id'],
                        set_={k: getattr(stmt.excluded, k) for k in data.keys() if k != 'activity_id'}
                    )
                    session.execute(stmt)
                    migrated_count += 1
                    
                    # Commit in batches
                    if migrated_count % 100 == 0:
                        session.commit()
                        logger.info(f"Migrated {migrated_count} activities...")
                    
                except Exception as e:
                    logger.warning(f"Error processing activity row: {e}")
                    continue
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} activities")
            
        except Exception as e:
            logger.error(f"Error migrating activities data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_weight_data(self):
        """Migrate weight data"""
        weight_dir = self.health_data_path / "Weight"
        if not weight_dir.exists():
            logger.warning("Weight directory not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            for file_path in weight_dir.glob("*.json"):
                day = self.parse_date_from_filename(file_path.name)
                if not day:
                    continue
                    
                data = self.load_json_data(file_path)
                if not data or 'dateWeightList' not in data:
                    logger.debug(f"No weight data or missing 'dateWeightList' in {file_path}")
                    continue

                weight_list = data.get('dateWeightList') or []
                if not weight_list:
                    logger.debug(f"Empty 'dateWeightList' in {file_path}")
                    continue

                weight_data = weight_list[0]  # Take first measurement of the day

                # Determine numeric weight in grams, accepting several possible keys/units
                weight_grams = None
                if isinstance(weight_data, dict):
                    if 'weight' in weight_data:
                        weight_grams = weight_data.get('weight')
                    elif 'weightInGrams' in weight_data:
                        weight_grams = weight_data.get('weightInGrams')
                    elif 'weightKg' in weight_data:
                        try:
                            kg = float(weight_data.get('weightKg'))
                            weight_grams = int(round(kg * 1000))
                        except Exception:
                            weight_grams = None
                    elif 'kg' in weight_data:
                        try:
                            kg = float(weight_data.get('kg'))
                            weight_grams = int(round(kg * 1000))
                        except Exception:
                            weight_grams = None
                    elif 'value' in weight_data:
                        try:
                            v = float(weight_data.get('value'))
                            if v < 300:
                                weight_grams = int(round(v * 1000))
                            else:
                                weight_grams = int(round(v))
                        except Exception:
                            weight_grams = None

                if weight_grams is None:
                    try:
                        # weight_data could be a plain number
                        w = float(weight_data)
                        if w < 300:
                            weight_grams = int(round(w * 1000))
                        else:
                            weight_grams = int(round(w))
                    except Exception:
                        weight_grams = None

                if weight_grams is None:
                    logger.warning(f"Could not determine numeric weight from {file_path}: {weight_data}")
                    continue

                weight_kg = float(weight_grams) / 1000.0

                stmt = insert(GarminWeight).values(
                    day=day,
                    weight_grams=weight_grams,
                    weight_kg=weight_kg,
                    bmi=weight_data.get('bmi') if isinstance(weight_data, dict) else None,
                    body_fat_percentage=weight_data.get('bodyFat') if isinstance(weight_data, dict) else None
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=['day'],
                    set_=dict(
                        weight_grams=stmt.excluded.weight_grams,
                        weight_kg=stmt.excluded.weight_kg,
                        bmi=stmt.excluded.bmi,
                        body_fat_percentage=stmt.excluded.body_fat_percentage
                    )
                )
                session.execute(stmt)
                migrated_count += 1
                
            session.commit()
            logger.info(f"Migrated {migrated_count} weight records")
            
        except Exception as e:
            logger.error(f"Error migrating weight data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def create_journal_entries(self):
        """Create daily journal entries for all days with Garmin data"""
        session = self.SessionLocal()
        
        try:
            # Get all unique days from daily summaries
            days_with_data = session.query(GarminDailySummary.day).all()
            created_count = 0
            
            for (day,) in days_with_data:
                # Check if journal entry already exists
                existing = session.query(DailyJournal).filter(DailyJournal.day == day).first()
                if not existing:
                    journal_entry = DailyJournal(day=day)
                    session.add(journal_entry)
                    created_count += 1
            
            session.commit()
            logger.info(f"Created {created_count} new journal entries")
            
        except Exception as e:
            logger.error(f"Error creating journal entries: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def run_migration(self):
        """Run the complete migration process"""
        logger.info("Starting enhanced Garmin data migration...")
        
        try:
            # Migrate all data types
            self.migrate_rhr_data()
            self.migrate_sleep_data()
            self.migrate_daily_summary_data()  # This includes steps and much more
            self.migrate_stress_data()  # Minute-by-minute stress data
            self.migrate_heart_rate_data()  # Minute-by-minute heart rate data
            self.migrate_respiratory_rate_data()  # Minute-by-minute respiratory rate data
            self.migrate_activities_data()  # Detailed activity data
            self.migrate_weight_data()
            
            # Create journal entries for all days with data
            self.create_journal_entries()
            
            logger.info("Migration completed successfully!")
            
            # Print summary
            self.print_migration_summary()
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

    def print_migration_summary(self):
        """Print migration summary"""
        session = self.SessionLocal()
        
        try:
            summary_count = session.query(GarminDailySummary).count()
            sleep_count = session.query(GarminSleepSession).count()
            weight_count = session.query(GarminWeight).count()
            journal_count = session.query(DailyJournal).count()
            
            print("\n" + "="*50)
            print("MIGRATION SUMMARY")
            print("="*50)
            print(f"Daily Summaries: {summary_count}")
            print(f"Sleep Sessions: {sleep_count}")
            print(f"Weight Records: {weight_count}")
            print(f"Journal Entries: {journal_count}")
            print("="*50)
            
        finally:
            session.close()

def main():
    """Main function"""
    migrator = EnhancedGarminMigrator()
    migrator.run_migration()

if __name__ == "__main__":
    main()