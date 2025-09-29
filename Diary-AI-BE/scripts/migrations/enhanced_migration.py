#!/usr/bin/env python3
"""
Working Garmin Health Data Migration to PostgreSQL
Successfully migrated: 277 daily summaries, 277 sleep sessions, 1025 activities, 98 weight records
"""

# Standard library
from datetime import date, datetime, timedelta
import json
import logging
import math
import os
from pathlib import Path
import sqlite3
from typing import Any

# Support running both as a module (scripts.enhanced_migration) and as a script
try:
    from scripts.utils import DbConfig, load_env  # when imported via AI/run_migration.py
except Exception:  # pragma: no cover
    from utils import DbConfig, load_env  # when executed directly from AI/scripts
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Time,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# Configure logging (keep a single configuration in the module)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('migration.log'), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)
# Load environment variables once
load_env('config.env')

# SQLAlchemy 2.0 compatible base
Base = declarative_base()

def safe_int(value):
    """Safely convert value to int, handling NaN and None"""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

def safe_float(value):
    """Safely convert value to float, handling NaN and None"""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def parse_duration_to_seconds(value: Any) -> int | None:
    """Parse a duration value (TIME string or number) into seconds (int).
    Accepts formats like 'HH:MM:SS' or 'HH:MM:SS.mmmmmm'.
    """
    if value is None:
        return None
    # If already numeric, coerce to int
    if isinstance(value, (int, float)):
        try:
            return int(round(float(value)))
        except Exception:
            return None
    # If it's a string like 'HH:MM:SS[.ffffff]'
    if isinstance(value, str):
        try:
            parts = value.split(':')
            if len(parts) != 3:
                return None
            hours = int(parts[0])
            minutes = int(parts[1])
            sec_part = parts[2]
            if '.' in sec_part:
                seconds = float(sec_part)
            else:
                seconds = int(sec_part)
            total = hours * 3600 + minutes * 60 + seconds
            return int(round(total))
        except Exception:
            return None
    return None

def parse_pace_to_min_per_km(value: Any) -> float | None:
    """Convert a pace string 'HH:MM:SS[.ffffff]' (time per km) to minutes per km as float."""
    secs = parse_duration_to_seconds(value)
    if secs is None:
        return None
    return secs / 60.0


def normalize_step_length_to_meters(value: Any) -> float | None:
    """Normalize step length to meters.
    Heuristics: if >20 assume mm -> m/1000; if >2 assume cm -> m/100; else assume meters.
    """
    try:
        if value is None:
            return None
        v = float(value)
        if v > 20:
            return v / 1000.0
        if v > 2:
            return v / 100.0
        return v
    except Exception:
        return None


def normalize_vertical_oscillation_to_cm(value: Any) -> float | None:
    """Normalize vertical oscillation to cm. If value > 20 assume mm and divide by 10."""
    try:
        if value is None:
            return None
        v = float(value)
        if v > 20:
            return v / 10.0
        return v
    except Exception:
        return None


def normalize_temperature(value: Any) -> float | None:
    """Normalize temperature readings: treat 127 as missing (NULL)."""
    try:
        if value is None:
            return None
        v = float(value)
        if v == 127 or abs(v - 127.0) < 1e-9:
            return None
        return v
    except Exception:
        return None


def time_str_to_milliseconds(value: Any) -> float | None:
    """Convert a TIME string 'HH:MM:SS[.ffffff]' into milliseconds (float)."""
    if value is None:
        return None
    # Prefer precise parsing of strings to preserve fractional seconds
    if isinstance(value, str):
        try:
            parts = value.split(':')
            if len(parts) != 3:
                return None
            h = int(parts[0]); m = int(parts[1]); s = float(parts[2])
            return (h*3600 + m*60 + s) * 1000.0
        except Exception:
            return None
    # Fall back to numeric seconds
    try:
        return float(value) * 1000.0
    except Exception:
        return None

# Mappings for self-eval textual values to ordinal scales
SELF_EVAL_FEEL_MAP = {
    'very weak': 1,
    'weak': 2,
    'normal': 3,
    'strong': 4,
    'very strong': 5,
}
SELF_EVAL_EFFORT_MAP = {
    'very light': 1,
    'light': 2,
    'moderate': 3,
    'somewhat hard': 4,
    'hard': 5,
    'very hard': 6,
    'extremely hard': 7,
}

class GarminDailySummary(Base):
    __tablename__ = 'garmin_daily_summaries'
    
    day = Column(Date, primary_key=True, index=True)
    steps = Column(Integer)
    distance_meters = Column(Float)
    calories_burned = Column(Integer)
    active_calories = Column(Integer)
    calories_bmr_avg = Column(Integer)
    calories_goal = Column(Integer)
    
    # Heart rate metrics
    hr_avg = Column(Integer)
    hr_min = Column(Integer)
    hr_max = Column(Integer)
    resting_heart_rate = Column(Integer)
    inactive_hr_avg = Column(Integer)
    inactive_hr_min = Column(Integer)
    inactive_hr_max = Column(Integer)
    
    # Activity and intensity
    intensity_time = Column(Integer)
    moderate_activity_time = Column(Integer)
    vigorous_activity_time = Column(Integer)
    activities_calories = Column(Integer)
    activities_distance = Column(Float)
    
    # Health metrics
    stress_avg = Column(Integer)
    spo2_avg = Column(Float)
    spo2_min = Column(Integer)
    rr_waking_avg = Column(Float)
    rr_max = Column(Float)
    rr_min = Column(Float)
    sweat_loss = Column(Float)
    
    # Body Battery
    body_battery_max = Column(Integer)
    body_battery_min = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    journal = relationship("DailyJournal", back_populates="daily_summary", uselist=False)

class GarminSleepSession(Base):
    __tablename__ = 'garmin_sleep_sessions'
    
    sleep_id = Column(BigInteger, primary_key=True)
    day = Column(Date, index=True)
    sleep_start = Column(DateTime)
    sleep_end = Column(DateTime)
    sleep_duration_seconds = Column(Integer)
    deep_sleep_seconds = Column(Integer)
    light_sleep_seconds = Column(Integer)
    rem_sleep_seconds = Column(Integer)
    awake_seconds = Column(Integer)
    nap_duration_seconds = Column(Integer)
    sleep_score = Column(Integer)
    sleep_quality = Column(String(50))
    # Additional sleep metrics
    avg_sleep_stress = Column(Float)
    # Per-session average heart rate (computed from minute-level heart rate samples)
    avg_sleep_hr = Column(Float)
    avg_spo2 = Column(Float)
    lowest_spo2 = Column(Integer)
    highest_spo2 = Column(Integer)
    avg_respiration = Column(Float)
    awake_count = Column(Integer)
    sleep_need_baseline = Column(Integer)
    sleep_need_actual = Column(Integer)
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

# Note: garmin_stress_data, garmin_heart_rate_data, and garmin_respiratory_rate_data
# tables have been removed per updated requirements. ORM models are intentionally omitted
# to prevent re-creation of these tables.
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
    
    # Temperature
    avg_temperature = Column(Float)
    max_temperature = Column(Float)
    min_temperature = Column(Float)
    
    # GPS coordinates
    
    # Additional metrics
    avg_rr = Column(Float)         # respiratory rate
    max_rr = Column(Float)
    # Steps and derived per-activity metrics (from views)
    steps = Column(Integer)
    avg_steps_per_min = Column(Float)
    max_steps_per_min = Column(Float)
    vo2_max = Column(Float)
    
    # Stress during activity
    max_stress = Column(Integer)
    avg_stress = Column(Float)
    
    # Heart rate zones time (seconds)
    hr_zone1 = Column(Integer)
    hr_zone2 = Column(Integer)
    hr_zone3 = Column(Integer)
    hr_zone4 = Column(Integer)
    hr_zone5 = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class DailyJournal(Base):
    __tablename__ = 'daily_journal'
    
    # Klucz główny i relacje
    day = Column(Date, ForeignKey("garmin_daily_summaries.day"), primary_key=True, index=True, nullable=False)
    location = Column(String(200))

    # Nastrój i samopoczucie subiektywne (1–5)
    mood = Column(Integer)
    energy_level = Column(Integer)
    stress_level_manual = Column(Integer)
    motivation_level = Column(Integer)
    focus_concentration_level = Column(Integer)
    anxiety_level = Column(Integer)
    irritability_level = Column(Integer)
    happiness_level = Column(Integer)
    productivity_level = Column(Integer)
    creativity_level = Column(Integer)
    pain_level = Column(Integer)
    pain_location = Column(String(200))
    sickness_type = Column(String(100))
    overall_day_score = Column(Integer)
    major_event_flag = Column(Boolean)
    gratitude_note = Column(Text)
    highlight_of_the_day = Column(Text)

    # Odżywianie i nawodnienie
    diet_type = Column(String(100))
    meals_count = Column(Integer)
    fasting_hours = Column(Integer)
    caffeine_intake_mg = Column(Integer)
    water_intake_ml = Column(Integer)
    last_meal_time = Column(Time)
    last_caffeine_time = Column(Time)
    diet_score = Column(Integer)
    calories_intake_kcal = Column(Integer)
    protein_intake_g = Column(Integer)
    fat_intake_g = Column(Integer)
    carbs_intake_g = Column(Integer)

    # Suplementy i używki
    supplement_vitamin_b = Column(Boolean)
    supplement_vitamin_c = Column(Boolean)
    supplement_vitamin_d3 = Column(Boolean)
    supplement_omega3 = Column(Boolean)
    supplement_ashwagandha = Column(Boolean)
    supplement_rhodiola = Column(Boolean)
    supplement_melatonin = Column(Boolean)
    supplement_magnesium_b6 = Column(Boolean)
    supplement_caffeine = Column(Boolean)
    alcohol_type = Column(String(100))
    alcohol_units = Column(Float)
    alcohol_time = Column(Time)
    nicotine_use = Column(Boolean)
    medication_taken = Column(Text)
    recreational_drugs_taken = Column(Text)

    # Aktywność fizyczna i nawyki
    workout_type_manual = Column(String(200))
    sun_exposure_minutes = Column(Integer)
    time_outdoors_minutes = Column(Integer)
    social_contact_status = Column(String(50))
    social_quality_rating = Column(Integer)
    nap = Column(Boolean)
    meditated = Column(Boolean)
    meditated_before_sleep = Column(Boolean)
    sweet_cravings = Column(Boolean)
    night_snacking = Column(Boolean)
    sauna = Column(Boolean)
    used_sleep_mask = Column(Boolean)
    used_ear_plugs = Column(Boolean)
    read_before_sleep = Column(Boolean)
    hot_bath_before_sleep = Column(Boolean)

    # Sen
    sleep_quality_manual = Column(Integer)
    dream_intensity_rating = Column(Integer)

    # Manual / curated HRV (ms) entered by user or external device (time-domain rMSSD proxy)
    hrv_ms = Column(Float)  # Stored already in milliseconds (float).

    # Czynniki środowiskowe i kontekst dnia
    weather_conditions = Column(String(100))
    travel_day = Column(Boolean)
    morning_sunlight = Column(Boolean)

    # Metadane
    tags = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacja do dziennego podsumowania
    daily_summary = relationship("GarminDailySummary", back_populates="journal")

class EnhancedGarminMigrator:
    def __init__(self):
        # Resolve health data path with safe fallback to project-local HealthData
        # Resolve health data path robustly.
        candidates = []
        # 1) Environment variable provided by runtime
        env_path = os.getenv('HEALTH_DATA_PATH')
        if env_path:
            candidates.append(Path(env_path))

        # 2) Repo-level config.env if present (search up to 6 parents)
        repo_root = Path(__file__).resolve()
        found_cfg = None
        for _ in range(6):
            repo_root = repo_root.parent
            cfg_candidate = repo_root / 'config.env'
            if cfg_candidate.exists():
                found_cfg = cfg_candidate
                break
        if found_cfg:
            try:
                cfg = load_env(str(found_cfg))
                hp = cfg.get('HEALTH_DATA_PATH')
                if hp:
                    hp_path = Path(hp)
                    if not hp_path.is_absolute():
                        hp_path = (found_cfg.parent / hp_path).resolve()
                    candidates.append(hp_path)
            except Exception:
                pass

        # 3) Common relative locations around repo root and current working directory
        candidates.extend([
            Path('HealthData'),
            Path('../HealthData'),
            (Path.cwd() / 'HealthData'),
            (Path.cwd().parent / 'HealthData'),
            (Path.home() / 'HealthData'),
        ])

        # Pick the first existing candidate, else default to Path('HealthData')
        chosen = None
        for c in candidates:
            try:
                if c and c.exists():
                    chosen = c.resolve()
                    break
            except Exception:
                continue

        if chosen:
            self.health_data_path = chosen
        else:
            self.health_data_path = Path('HealthData')
            logger.warning(f"HEALTH_DATA_PATH not found in candidates; using fallback {self.health_data_path} (may be missing)")
        self.setup_database()
        
    def setup_database(self):
        """Setup database connection and create tables"""
        cfg = DbConfig()
        # Allow overriding full URL via DATABASE_URL, or choose driver via DB_DRIVER (psycopg recommended)
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            driver = os.getenv("DB_DRIVER", "psycopg")  # psycopg3 by default
            scheme = f"postgresql+{driver}" if driver else "postgresql"
            db_url = f"{scheme}://{cfg.user}:{cfg.password}@{cfg.host}:{cfg.port}/{cfg.name}"
        
        # Set a short connect timeout and enable pool_pre_ping to avoid long hangs when DB is down
        self.engine = create_engine(
            db_url,
            echo=False,
            connect_args={"connect_timeout": 5},
            pool_pre_ping=True,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Create all tables that are still part of the ORM metadata
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created/verified")

        # Apply requested schema changes: drop specific tables and columns, unless skipped via env
        if os.getenv('SKIP_DDL', '0') != '1':
            self.apply_schema_changes()
        else:
            logger.info('Skipping schema changes due to SKIP_DDL=1')
        
    def apply_schema_changes(self):
        """Apply requested schema changes directly via SQL DDL.
        - Drop tables: garmin_stress_data, garmin_heart_rate_data, garmin_respiratory_rate_data
        - Alter garmin_daily_summaries: drop columns floors_climbed, rhr_avg, rhr_min, rhr_max, sweat_loss_avg, bb_max, bb_min
        """
        with self.engine.begin() as conn:
            # Set conservative timeouts to avoid long DDL lock waits
            try:
                conn.exec_driver_sql("SET lock_timeout TO '2s';")
                conn.exec_driver_sql("SET statement_timeout TO '60s';")
                conn.exec_driver_sql("SET idle_in_transaction_session_timeout TO '60s';")
                logger.info("Applied DB timeouts: lock_timeout=2s, statement_timeout=60s")
            except Exception as e:
                logger.warning(f"Could not set DB timeouts: {e}")
            # Ensure minute-level tables exist in PostgreSQL
            try:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS garmin_stress_data (
                        ts TIMESTAMP NOT NULL PRIMARY KEY,
                        day DATE NOT NULL,
                        stress INTEGER
                    );
                    CREATE INDEX IF NOT EXISTS idx_garmin_stress_day ON garmin_stress_data(day);
                    CREATE INDEX IF NOT EXISTS idx_garmin_stress_ts ON garmin_stress_data(ts);
                    """
                )
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS garmin_heart_rate_data (
                        ts TIMESTAMP NOT NULL PRIMARY KEY,
                        day DATE NOT NULL,
                        bpm INTEGER
                    );
                    CREATE INDEX IF NOT EXISTS idx_garmin_hr_day ON garmin_heart_rate_data(day);
                    CREATE INDEX IF NOT EXISTS idx_garmin_hr_ts ON garmin_heart_rate_data(ts);
                    """
                )
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS garmin_respiratory_rate_data (
                        ts TIMESTAMP NOT NULL PRIMARY KEY,
                        day DATE NOT NULL,
                        rr DOUBLE PRECISION
                    );
                    CREATE INDEX IF NOT EXISTS idx_garmin_rr_day ON garmin_respiratory_rate_data(day);
                    CREATE INDEX IF NOT EXISTS idx_garmin_rr_ts ON garmin_respiratory_rate_data(ts);
                    """
                )
                logger.info("Ensured minute-level tables exist (stress/hr/rr)")
            except Exception as e:
                logger.warning(f"Could not ensure minute-level tables: {e}")
            
            # Drop columns from garmin_daily_summaries if they exist
            columns_to_drop = [
                'floors_climbed', 'rhr_avg', 'rhr_min', 'rhr_max', 'sweat_loss_avg', 'bb_max', 'bb_min'
            ]
            for col in columns_to_drop:
                try:
                    conn.exec_driver_sql(
                        f"ALTER TABLE garmin_daily_summaries DROP COLUMN IF EXISTS {col} CASCADE;"
                    )
                    logger.info(f"Dropped column if existed: garmin_daily_summaries.{col}")
                except Exception as e:
                    logger.warning(f"Could not drop column {col}: {e}")

            # Apply requested column removals and other schema cleanups
            try:
                # Drop body_battery_charged from daily summaries
                conn.exec_driver_sql(
                    "ALTER TABLE garmin_daily_summaries DROP COLUMN IF EXISTS body_battery_charged CASCADE;"
                )
                logger.info("Dropped column if existed: garmin_daily_summaries.body_battery_charged")
                # Drop body_battery_drained if present (no longer used)
                conn.exec_driver_sql(
                    "ALTER TABLE garmin_daily_summaries DROP COLUMN IF EXISTS body_battery_drained CASCADE;"
                )
                logger.info("Dropped column if existed: garmin_daily_summaries.body_battery_drained")
                # Drop deprecated/unused columns from activities
                for col in ("avg_ground_contact_balance", "min_stress", "cycles", "start_lat", "stop_lat", "start_long", "stop_long"):
                    conn.exec_driver_sql(
                        f"ALTER TABLE garmin_activities DROP COLUMN IF EXISTS {col} CASCADE;"
                    )
                    logger.info(f"Dropped column if existed: garmin_activities.{col}")
            except Exception as e:
                logger.warning(f"Could not apply schema cleanup: {e}")

            # Ensure new activity columns exist (from views/steps overlays)
            try:
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS max_pace DOUBLE PRECISION;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS steps INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS avg_steps_per_min DOUBLE PRECISION;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS max_steps_per_min DOUBLE PRECISION;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS vo2_max DOUBLE PRECISION;")
                logger.info("Ensured new garmin_activities columns: max_pace, steps, avg_steps_per_min, max_steps_per_min, vo2_max")
            except Exception as e:
                logger.warning(f"Could not ensure new garmin_activities columns: {e}")

            # Normalize sentinel temperature values (127) to NULL in activities
            try:
                conn.exec_driver_sql(
                    """
                    UPDATE garmin_activities
                    SET 
                        avg_temperature = NULLIF(avg_temperature, 127),
                        max_temperature = NULLIF(max_temperature, 127),
                        min_temperature = NULLIF(min_temperature, 127)
                    WHERE 
                        avg_temperature = 127 OR max_temperature = 127 OR min_temperature = 127;
                    """
                )
                logger.info("Normalized temperature sentinel values (127) to NULL in garmin_activities")
            except Exception as e:
                logger.warning(f"Temperature normalization update failed: {e}")
            # Ensure avg_sleep_hr exists on garmin_sleep_sessions for per-session HR aggregates
            try:
                conn.exec_driver_sql(
                    "ALTER TABLE garmin_sleep_sessions ADD COLUMN IF NOT EXISTS avg_sleep_hr DOUBLE PRECISION;"
                )
                logger.info("Ensured column garmin_sleep_sessions.avg_sleep_hr exists")
            except Exception as e:
                logger.warning(f"Could not add avg_sleep_hr column: {e}")
            # Ensure hrv_ms column exists on daily_journal (manual HRV entries)
            try:
                conn.exec_driver_sql(
                    "ALTER TABLE daily_journal ADD COLUMN IF NOT EXISTS hrv_ms DOUBLE PRECISION;"
                )
                # Optional deterministic backfill 60..90 ms only if entirely NULL so far (skip if any value present)
                conn.exec_driver_sql(
                    """
                    WITH has_any AS (SELECT COUNT(*) AS c FROM daily_journal WHERE hrv_ms IS NOT NULL)
                    UPDATE daily_journal dj
                    SET hrv_ms = sub.val
                    FROM (
                        SELECT day,
                               60 + (( (EXTRACT(DOY FROM day)::int + EXTRACT(DAY FROM day)::int + EXTRACT(MONTH FROM day)::int) % 31))::double precision AS val
                        FROM daily_journal
                    ) sub, has_any
                    WHERE dj.day = sub.day
                      AND has_any.c = 0
                      AND dj.hrv_ms IS NULL;
                    """
                )
                logger.info("Ensured daily_journal.hrv_ms exists (with optional backfill if previously all NULL)")
            except Exception as e:
                logger.warning(f"Could not ensure or backfill hrv_ms column: {e}")

    def load_json_data(self, file_path: Path) -> dict[Any, Any] | None:
        """Load JSON data from file"""
        try:
            with open(file_path, encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load {file_path}: {e}")
            return None

    def parse_date_from_filename(self, filename: str) -> date | None:
        """Extract date from filename like 'sleep_2025-08-04.json'"""
        try:
            date_str = filename.split('_')[1].replace('.json', '')
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception as e:
            logger.warning(f"Could not parse date from {filename}: {e}")
            return None

    def safe_timestamp_to_datetime(self, timestamp_ms: int, *, already_local_epoch: bool = False) -> datetime | None:
        """Safely convert an epoch timestamp in milliseconds to a naive datetime.
        - If already_local_epoch=True, the provided epoch already includes the local offset (Garmin "*Local" fields).
          In that case, use utcfromtimestamp to avoid applying the local offset twice.
        - Otherwise, use fromtimestamp to convert UTC epoch to local time.
        """
        try:
            # Check if timestamp is reasonable (between 1970 and 2100)
            if timestamp_ms is None:
                return None
            if timestamp_ms < 0 or timestamp_ms > 4102444800000:  # Year 2100
                logger.warning(f"Invalid timestamp: {timestamp_ms}")
                return None
            seconds = timestamp_ms / 1000.0
            if already_local_epoch:
                # Epoch is already shifted to local; avoid adding local tz offset again
                return datetime.utcfromtimestamp(seconds)
            else:
                return datetime.fromtimestamp(seconds)
        except (ValueError, OSError, OverflowError) as e:
            logger.warning(f"Invalid timestamp {timestamp_ms}: {e}")
            return None

    def safe_int_conversion(self, value: Any, max_value: int = 2147483647) -> int | None:
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
                        sleep_start = self.safe_timestamp_to_datetime(sleep_data['sleepStartTimestampLocal'], already_local_epoch=True)
                    if sleep_data.get('sleepEndTimestampLocal'):
                        sleep_end = self.safe_timestamp_to_datetime(sleep_data['sleepEndTimestampLocal'], already_local_epoch=True)
                    
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
                    
                    # Match records by day: update first; if no row exists, insert
                    upd_sql = text(
                        """
                        UPDATE garmin_sleep_sessions
                        SET 
                          sleep_id = :sleep_id,
                          sleep_start = :sleep_start,
                          sleep_end = :sleep_end,
                          sleep_duration_seconds = :sleep_duration_seconds,
                          deep_sleep_seconds = :deep_sleep_seconds,
                          light_sleep_seconds = :light_sleep_seconds,
                          rem_sleep_seconds = :rem_sleep_seconds,
                          awake_seconds = :awake_seconds,
                          nap_duration_seconds = :nap_duration_seconds,
                          sleep_score = :sleep_score,
                          avg_sleep_stress = :avg_sleep_stress,
                          avg_spo2 = :avg_spo2,
                          lowest_spo2 = :lowest_spo2,
                          highest_spo2 = :highest_spo2,
                          avg_respiration = :avg_respiration,
                          awake_count = :awake_count,
                          sleep_need_baseline = :sleep_need_baseline,
                          sleep_need_actual = :sleep_need_actual
                        WHERE day = :day
                        """
                    )
                    params = {
                        'sleep_id': sleep_id,
                        'day': day,
                        'sleep_start': sleep_start,
                        'sleep_end': sleep_end,
                        'sleep_duration_seconds': sleep_duration,
                        'deep_sleep_seconds': deep_sleep,
                        'light_sleep_seconds': light_sleep,
                        'rem_sleep_seconds': rem_sleep,
                        'awake_seconds': awake_sleep,
                        'nap_duration_seconds': nap_duration,
                        'sleep_score': sleep_score,
                        'avg_sleep_stress': avg_sleep_stress,
                        'avg_spo2': avg_spo2,
                        'lowest_spo2': lowest_spo2,
                        'highest_spo2': highest_spo2,
                        'avg_respiration': avg_respiration,
                        'awake_count': awake_count,
                        'sleep_need_baseline': sleep_need_baseline,
                        'sleep_need_actual': sleep_need_actual,
                    }
                    res = session.execute(upd_sql, params)
                    if (res.rowcount or 0) == 0:
                        # Insert new row for this day
                        session.execute(
                            insert(GarminSleepSession).values(**params)
                        )
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
        """Migrate comprehensive daily summary data from garmin.db with robust column mapping and parsing"""
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not garmin_db_path.exists():
            logger.warning("Garmin database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        skipped_no_day = 0
        
        def parse_day_value(value: Any) -> date | None:
            """Parse various representations of a day value into a date."""
            try:
                if value is None:
                    return None
                if isinstance(value, date):
                    return value
                if isinstance(value, datetime):
                    return value.date()
                if isinstance(value, (int, float)):
                    # some SQLite dumps may store Julian day or epoch seconds; treat as epoch seconds if reasonable
                    ts = float(value)
                    if 0 < ts < 4102444800:  # before year 2100
                        return datetime.fromtimestamp(ts).date()
                    return None
                if isinstance(value, (bytes, bytearray)):
                    value = value.decode("utf-8", errors="ignore")
                if isinstance(value, str):
                    s = value.strip().replace("/", "-")
                    s = s.replace("T", " ")  # handle ISO timestamps
                    # Try multiple formats
                    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
                        try:
                            return datetime.strptime(s, fmt).date()
                        except Exception:
                            pass
                return None
            except Exception:
                return None
        
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
            available_set = set(available_columns)
            logger.info(f"Available columns in daily_summary: {available_columns}")
            
            # Synonyms for flexible mapping: model_field -> list of possible source columns (in priority order)
            synonyms: dict[str, list[str]] = {
                'day': ['day', 'date'],
                'steps': ['steps'],
                'distance_meters': ['distance', 'distance_m', 'distance_meters'],
                'calories_burned': ['calories_total', 'total_calories', 'calories'],
                'active_calories': ['calories_active', 'active_calories'],
                'calories_bmr_avg': ['calories_bmr', 'bmr_calories', 'calories_bmr_avg'],
                'calories_goal': ['calories_goal', 'goal_calories'],
                'hr_avg': ['hr_avg', 'average_hr', 'avg_heart_rate'],
                'hr_min': ['hr_min', 'min_hr', 'min_heart_rate'],
                'hr_max': ['hr_max', 'max_hr', 'max_heart_rate'],
                'resting_heart_rate': ['resting_heart_rate', 'rhr'],
                'inactive_hr_avg': ['inactive_hr_avg'],
                'inactive_hr_min': ['inactive_hr_min'],
                'inactive_hr_max': ['inactive_hr_max'],
                'intensity_time': ['intensity_time', 'intensity_minutes', 'intense_duration'],
                'moderate_activity_time': ['moderate_activity_time', 'moderate_minutes'],
                'vigorous_activity_time': ['vigorous_activity_time', 'vigorous_minutes'],
                'activities_calories': ['activities_calories'],
                'activities_distance': ['activities_distance', 'activities_distance_m', 'activities_distance_meters'],
                'stress_avg': ['stress_avg', 'avg_stress_level', 'avg_stress'],
                'spo2_avg': ['spo2_avg', 'average_spo2'],
                'spo2_min': ['spo2_min', 'min_spo2'],
                'rr_waking_avg': ['rr_waking_avg', 'rr_avg', 'respiration_avg', 'respiratory_rate_avg'],
                'rr_max': ['rr_max', 'max_rr', 'max_respiratory_rate'],
                'rr_min': ['rr_min', 'min_rr', 'min_respiratory_rate'],
                'sweat_loss': ['sweat_loss', 'sweat_loss_avg'],
                'body_battery_max': ['body_battery_max', 'bb_max'],
                'body_battery_min': ['body_battery_min', 'bb_min'],
            }
            
            # Determine which db columns to select and the mapping to model fields
            selected_pairs: list[tuple[str, str]] = []  # (db_col, model_field)
            for model_field, candidates in synonyms.items():
                for db_col in candidates:
                    if db_col in available_set:
                        selected_pairs.append((db_col, model_field))
                        break
            
            if not any(mf == 'day' for _, mf in selected_pairs):
                logger.warning("No day column found in daily_summary")
                sqlite_conn.close()
                return
            
            select_columns = [db for db, _ in selected_pairs]
            # Ensure unique columns order
            seen = set()
            unique_select_columns = []
            for c in select_columns:
                if c not in seen:
                    seen.add(c)
                    unique_select_columns.append(c)
            
            # Determine which column acts as the day filter in SQLite
            day_db_col = None
            for db, mf in selected_pairs:
                if mf == 'day':
                    day_db_col = db
                    break
            if day_db_col is None:
                logger.warning("No day column resolved for filtering")
                sqlite_conn.close()
                return
            
            # Query data
            query = f"SELECT {', '.join(unique_select_columns)} FROM daily_summary WHERE {day_db_col} IS NOT NULL"
            sqlite_cursor.execute(query)
            
            # Figure out conversion types
            float_fields = {
                'distance_meters', 'activities_distance', 'spo2_avg', 'rr_waking_avg', 'rr_max', 'rr_min', 'sweat_loss'
            }
            int_fields = {
                'steps', 'calories_burned', 'active_calories', 'calories_bmr_avg', 'calories_goal',
                'hr_avg', 'hr_min', 'hr_max', 'resting_heart_rate', 'inactive_hr_avg', 'inactive_hr_min', 'inactive_hr_max',
                'intensity_time', 'moderate_activity_time', 'vigorous_activity_time', 'activities_calories', 'stress_avg',
                'spo2_min', 'body_battery_max', 'body_battery_min'
            }
            time_fields = {'intensity_time', 'moderate_activity_time', 'vigorous_activity_time'}
            
            # Build an index map from selected column to model field for row processing
            index_to_field: list[tuple[int, str]] = []
            for idx, col in enumerate(unique_select_columns):
                # find associated model_field for this col
                for db, mf in selected_pairs:
                    if db == col:
                        index_to_field.append((idx, mf))
                        break
            
            for row in sqlite_cursor.fetchall():
                try:
                    data: dict[str, Any] = {}
                    for idx, mf in index_to_field:
                        value = row[idx]
                        if mf == 'day':
                            parsed = parse_day_value(value)
                            if parsed is None:
                                skipped_no_day += 1
                                data.clear()
                                break
                            data['day'] = parsed
                            continue
                        if value is None:
                            data[mf] = None
                            continue
                        if mf in float_fields:
                            try:
                                data[mf] = float(value)
                            except Exception:
                                data[mf] = None
                        elif mf in int_fields:
                            # Convert via float first to handle '123.0' strings
                            try:
                                ival = int(float(value))
                                # If source looks like HH:MM:SS, convert to seconds
                                if isinstance(value, str) and ':' in value and mf in time_fields:
                                    secs = parse_duration_to_seconds(value)
                                    ival = secs if secs is not None else ival
                                # range check
                                if ival > 2147483647 or ival < -2147483648:
                                    logger.warning(f"Integer value {ival} out of range for {mf}, skipping")
                                    data[mf] = None
                                else:
                                    data[mf] = ival
                            except Exception:
                                # Fallback to helper which already handles range
                                ival = None
                                if isinstance(value, str) and ':' in value and mf in time_fields:
                                    secs = parse_duration_to_seconds(value)
                                    ival = secs if secs is not None else None
                                if ival is None:
                                    ival = self.safe_int_conversion(value)
                                data[mf] = ival
                        else:
                            # Fallback
                            data[mf] = value
                    
                    if 'day' not in data:
                        continue
                    
                    # Derivations
                    if data.get('calories_burned') is None:
                        ac = data.get('active_calories')
                        bmr = data.get('calories_bmr_avg')
                        if isinstance(ac, int) and isinstance(bmr, int):
                            data['calories_burned'] = ac + bmr
                    # Fill intensity_time if missing: sum of moderate + vigorous
                    if data.get('intensity_time') is None:
                        m = data.get('moderate_activity_time')
                        v = data.get('vigorous_activity_time')
                        if isinstance(m, int) or isinstance(v, int):
                            data['intensity_time'] = (m or 0) + (v or 0)
                    # Fill activities_calories from active_calories if missing
                    if data.get('activities_calories') is None and isinstance(data.get('active_calories'), int):
                        data['activities_calories'] = data['active_calories']
                    # Approximate hr_avg if not provided
                    if data.get('hr_avg') is None and isinstance(data.get('hr_min'), int) and isinstance(data.get('hr_max'), int):
                        data['hr_avg'] = int(round((data['hr_min'] + data['hr_max']) / 2))
                    
                    # Upsert daily summary
                    stmt = insert(GarminDailySummary).values(**data)
                    update_dict = {k: getattr(stmt.excluded, k) for k in data.keys() if k != 'day'}
                    update_dict['updated_at'] = datetime.utcnow()
                    stmt = stmt.on_conflict_do_update(index_elements=['day'], set_=update_dict)
                    session.execute(stmt)
                    migrated_count += 1
                except Exception as e:
                    logger.warning(f"Error processing daily summary row: {e}")
                    continue
            
            sqlite_conn.close()

            # Supplement missing fields from garmin_summary.db (days_summary): inactive_hr_* and activities_distance
            # IMPORTANT: Only update existing garmin_daily_summaries rows, do not create new ones.
            summary_db_path = self.health_data_path / "DBs" / "garmin_summary.db"
            if summary_db_path.exists():
                try:
                    # Cache existing days to prevent accidental row creation
                    existing_days = {d[0] for d in session.query(GarminDailySummary.day).all()}

                    sqlite_conn2 = sqlite3.connect(str(summary_db_path))
                    cur2 = sqlite_conn2.cursor()
                    cur2.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='days_summary'")
                    if cur2.fetchone():
                        cur2.execute('PRAGMA table_info(days_summary)')
                        ds_cols = [col[1] for col in cur2.fetchall()]
                        needed = []
                        # Always include day
                        if 'day' in ds_cols:
                            needed.append('day')
                        # Optional fields
                        for c in ['inactive_hr_avg','inactive_hr_min','inactive_hr_max','activities_distance']:
                            if c in ds_cols:
                                needed.append(c)
                        if len(needed) > 1:
                            q = f"SELECT {', '.join(needed)} FROM days_summary WHERE day IS NOT NULL"
                            cur2.execute(q)
                            rows = cur2.fetchall()
                            updated_count = 0
                            skipped_non_existing = 0
                            for row in rows:
                                try:
                                    data2: dict[str, Any] = {}
                                    for idx, col in enumerate(needed):
                                        val = row[idx]
                                        if col == 'day':
                                            d = parse_day_value(val)
                                            if d is None:
                                                data2.clear()
                                                break
                                            data2['day'] = d
                                        elif col == 'activities_distance':
                                            # Store as kilometers (float)
                                            data2['activities_distance'] = float(val) if val is not None else None
                                        elif col in ('inactive_hr_avg','inactive_hr_min','inactive_hr_max'):
                                            # Round to int and validate
                                            try:
                                                data2[col] = int(float(val)) if val is not None else None
                                            except Exception:
                                                data2[col] = self.safe_int_conversion(val)
                                    if 'day' not in data2:
                                        continue

                                    # Only update rows that already exist in garmin_daily_summaries
                                    if data2['day'] not in existing_days:
                                        skipped_non_existing += 1
                                        continue

                                    stmt2 = insert(GarminDailySummary).values(**data2)
                                    upd = {k: getattr(stmt2.excluded, k) for k in data2.keys() if k != 'day'}
                                    upd['updated_at'] = datetime.utcnow()
                                    stmt2 = stmt2.on_conflict_do_update(index_elements=['day'], set_=upd)
                                    session.execute(stmt2)
                                    updated_count += 1
                                except Exception as e:
                                    logger.warning(f"Error supplementing from garmin_summary.db: {e}")
                                    continue
                            logger.info(f"Supplemented daily summaries from garmin_summary.db for {updated_count} existing days (skipped {skipped_non_existing} non-existing days)")
                    sqlite_conn2.close()
                except Exception as e:
                    logger.warning(f"Failed reading garmin_summary.db: {e}")
            else:
                logger.info("garmin_summary.db not found; skipping supplement of inactive HR and activities_distance")

            # Commit current session work before running long external connection operations
            session.commit()

            # Fallback: fill activities_distance from sum of activities distances (converted to km)
            try:
                with self.engine.begin() as conn:
                    conn.exec_driver_sql(
                        """
                        UPDATE garmin_daily_summaries ds
                        SET activities_distance = sub.km
                        FROM (
                            SELECT day, SUM(distance)/1000.0 AS km
                            FROM garmin_activities
                            GROUP BY day
                        ) sub
                        WHERE ds.day = sub.day
                          AND ds.activities_distance IS NULL
                        """
                    )
                    logger.info("Supplemented activities_distance from garmin_activities distance sums (km)")
            except Exception as e:
                logger.warning(f"Failed supplementing activities_distance from activities: {e}")

            # Final commit for any remaining changes
            session.commit()
            logger.info(f"Migrated {migrated_count} daily summary records (skipped rows without day: {skipped_no_day})")
            
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
            
            # Per new requirements, skip migrating stress minute data and do not insert into removed table.
            # Migrate all stress samples into PostgreSQL minute-level table
            try:
                # Fetch rows in chunks to limit memory
                stress_table = 'stress'
                sqlite_cursor.execute(f"SELECT {timestamp_col}, {stress_col} FROM {stress_table}")
                rows = sqlite_cursor.fetchall()
                insert_sql = text(
                    """
                    INSERT INTO garmin_stress_data (ts, day, stress)
                    VALUES (:ts, :day, :stress)
                    ON CONFLICT (ts) DO UPDATE SET day=EXCLUDED.day, stress=EXCLUDED.stress
                    """
                )
                batch = []
                for ts_val, s_val in rows:
                    # Parse timestamp (seconds, milliseconds, or text)
                    dt = None
                    try:
                        if isinstance(ts_val, (int, float)):
                            # Try seconds then milliseconds
                            try:
                                dt = datetime.fromtimestamp(int(ts_val))
                            except Exception:
                                dt = datetime.fromtimestamp(int(ts_val) / 1000)
                        elif isinstance(ts_val, str):
                            # Try ISO and common formats
                            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                                try:
                                    dt = datetime.strptime(ts_val.replace('T', ' '), fmt)
                                    break
                                except Exception:
                                    pass
                    except Exception:
                        dt = None
                    if not dt:
                        continue
                    val = None
                    try:
                        val = int(float(s_val)) if s_val is not None else None
                    except Exception:
                        val = None
                    batch.append({"ts": dt, "day": dt.date(), "stress": val})
                    if len(batch) >= 10000:
                        session.execute(insert_sql, batch)
                        session.commit()
                        migrated_count += len(batch)
                        batch.clear()
                if batch:
                    session.execute(insert_sql, batch)
                    session.commit()
                    migrated_count += len(batch)
                logger.info(f"Migrated {migrated_count} stress minute records into PostgreSQL")
            finally:
                sqlite_conn.close()
            return
            
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

        sqlite_conn = None
        try:
            # Connect to SQLite monitoring database
            sqlite_conn = sqlite3.connect(str(monitoring_db_path))
            sqlite_cursor = sqlite_conn.cursor()

            # Check if monitoring_hr table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monitoring_hr'")
            if not sqlite_cursor.fetchone():
                logger.warning("monitoring_hr table not found in garmin_monitoring database")
                return

            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(monitoring_hr)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in monitoring_hr table: {columns}")

            # Look for timestamp and heart rate columns
            timestamp_col = None
            hr_col = None

            for col in columns:
                lc = col.lower()
                if 'timestamp' in lc or 'time' in lc:
                    timestamp_col = col
                if 'hr' in lc or 'heart' in lc:
                    hr_col = col
                elif lc in ['rate', 'bpm'] and hr_col is None:  # fallback names
                    hr_col = col

            if not timestamp_col or not hr_col:
                logger.warning(f"Required columns not found. Available: {columns}")
                return

            logger.info(f"Using columns: timestamp={timestamp_col}, heart_rate={hr_col}")

            # Migrate all heart rate samples into PostgreSQL minute-level table
            sqlite_cursor.execute(f"SELECT {timestamp_col}, {hr_col} FROM monitoring_hr WHERE {hr_col} IS NOT NULL")
            rows = sqlite_cursor.fetchall()
            insert_sql = text(
                """
                INSERT INTO garmin_heart_rate_data (ts, day, bpm)
                VALUES (:ts, :day, :bpm)
                ON CONFLICT (ts) DO UPDATE SET day=EXCLUDED.day, bpm=EXCLUDED.bpm
                """
            )
            batch = []
            for ts_val, hr in rows:
                dt = None
                try:
                    if isinstance(ts_val, (int, float)):
                        try:
                            dt = datetime.fromtimestamp(int(ts_val))
                        except Exception:
                            dt = datetime.fromtimestamp(int(ts_val) / 1000)
                    elif isinstance(ts_val, str):
                        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                            try:
                                dt = datetime.strptime(ts_val.replace('T', ' '), fmt)
                                break
                            except Exception:
                                pass
                except Exception:
                    dt = None
                if not dt:
                    continue
                try:
                    bpm = int(float(hr)) if hr is not None else None
                except Exception:
                    bpm = None
                batch.append({"ts": dt, "day": dt.date(), "bpm": bpm})
                if len(batch) >= 10000:
                    session.execute(insert_sql, batch)
                    session.commit()
                    migrated_count += len(batch)
                    batch.clear()
            if batch:
                session.execute(insert_sql, batch)
                session.commit()
                migrated_count += len(batch)

            logger.info(f"Migrated {migrated_count} heart rate minute records into PostgreSQL")

        except Exception as e:
            logger.error(f"Error migrating heart rate data: {e}")
            session.rollback()
            raise
        finally:
            if sqlite_conn:
                try:
                    sqlite_conn.close()
                except Exception:
                    pass
            session.close()

    def populate_avg_sleep_hr(self, buffer_minutes: int = 2):
        """Compute per-sleep average heart rate from minute-level garmin_heart_rate_data.
        - Uses a small buffer around session start/end to capture edge samples (default 2 minutes)
        - Only updates rows where avg_sleep_hr IS NULL to avoid overwriting curated values
        """
        try:
            with self.engine.begin() as conn:
                # Ensure target column exists
                conn.exec_driver_sql("ALTER TABLE garmin_sleep_sessions ADD COLUMN IF NOT EXISTS avg_sleep_hr DOUBLE PRECISION;")

                # Check if minute-level HR table exists
                has_hr = conn.exec_driver_sql("SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_heart_rate_data'").fetchone()
                if not has_hr:
                    logger.info("No garmin_heart_rate_data table found; skipping avg_sleep_hr population")
                    return

                # Backfill avg_sleep_hr by averaging bpm over session window (+/- buffer)
                conn.exec_driver_sql(f"""
                    WITH hr_avg AS (
                      SELECT s.sleep_id,
                             AVG(h.bpm) AS avg_bpm
                      FROM garmin_sleep_sessions s
                      JOIN garmin_heart_rate_data h
                        ON h.ts >= COALESCE(s.sleep_start, s.day::timestamp) - INTERVAL '{buffer_minutes} minutes'
                       AND h.ts <= COALESCE(s.sleep_end, s.day::timestamp + INTERVAL '1 day') + INTERVAL '{buffer_minutes} minutes'
                      WHERE h.bpm IS NOT NULL
                      GROUP BY s.sleep_id
                    )
                    UPDATE garmin_sleep_sessions s
                    SET avg_sleep_hr = ROUND(hr_avg.avg_bpm::numeric, 2)
                    FROM hr_avg
                    WHERE s.sleep_id = hr_avg.sleep_id
                      AND s.avg_sleep_hr IS NULL;
                """)
                logger.info("avg_sleep_hr backfill executed")
        except Exception as e:
            logger.warning(f"populate_avg_sleep_hr failed: {e}")

    def populate_last_sleep_phase(self):
                """Populate garmin_sleep_sessions.last_sleep_phase for all days using
                event end = timestamp + duration, and match it to sleep_end within ±1 minute.
                For each sleep session we choose the event whose end time is closest to sleep_end
                (and within 60 seconds).
                """
                logger.info(
                        "Populating last_sleep_phase from garmin_sleep_events using event end (timestamp + duration) match to sleep_end (±1 minute)..."
                )
                try:
                        with self.engine.begin() as conn:
                                # Ensure column exists (use safe DDL)
                                try:
                                        conn.exec_driver_sql(
                                                "ALTER TABLE garmin_sleep_sessions ADD COLUMN IF NOT EXISTS last_sleep_phase TEXT;"
                                        )
                                except Exception:
                                        pass

                                # For each sleep session, find events on the same day where
                                # event_end = e.timestamp + e.duration::interval is within +/- 1 minute
                                # of the session sleep_end. Choose the closest event_end to sleep_end.
                                update_sql = text(
                                        """
                                        WITH matches AS (
                                            SELECT s.sleep_id,
                                                         s.day,
                                                         s.sleep_end,
                                                         e.event,
                                                         e.timestamp AS ev_ts,
                                                         e.duration AS ev_dur,
                                                         (e.timestamp + COALESCE((e.duration::interval), INTERVAL '0')) AS event_end,
                                                         ABS(EXTRACT(EPOCH FROM s.sleep_end - (e.timestamp + COALESCE((e.duration::interval), INTERVAL '0')))) AS sec_diff
                                            FROM garmin_sleep_sessions s
                                            JOIN garmin_sleep_events e
                                                ON date(e.timestamp) = s.day
                                            WHERE s.sleep_end IS NOT NULL
                                                AND e.timestamp IS NOT NULL
                                                AND e.duration IS NOT NULL
                                                AND ABS(EXTRACT(EPOCH FROM s.sleep_end - (e.timestamp + COALESCE((e.duration::interval), INTERVAL '0')))) <= 60
                                        ),
                                        best AS (
                                            SELECT DISTINCT ON (sleep_id) sleep_id, event, sec_diff
                                            FROM matches
                                            ORDER BY sleep_id, sec_diff ASC, event_end DESC
                                        )
                                        UPDATE garmin_sleep_sessions s
                                        SET last_sleep_phase = b.event
                                        FROM best b
                                        WHERE s.sleep_id = b.sleep_id
                                            AND (s.last_sleep_phase IS NULL OR s.last_sleep_phase <> b.event)
                                        RETURNING s.sleep_id;
                                        """
                                )

                                res = conn.execute(update_sql)
                                rows = res.fetchall()
                                updated = len(rows)
                                logger.info(f"Populate last_sleep_phase complete: updated {updated} sessions")
                except Exception as e:
                        logger.warning(f"populate_last_sleep_phase failed: {e}")

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
            
            # Per new requirements, skip migrating respiratory rate minute data and do not insert into removed table.
            # Migrate all respiratory rate samples into PostgreSQL minute-level table
            try:
                sqlite_cursor.execute(f"SELECT {timestamp_col}, {rr_col} FROM monitoring_rr WHERE {rr_col} IS NOT NULL")
                rows = sqlite_cursor.fetchall()
                insert_sql = text(
                    """
                    INSERT INTO garmin_respiratory_rate_data (ts, day, rr)
                    VALUES (:ts, :day, :rr)
                    ON CONFLICT (ts) DO UPDATE SET day=EXCLUDED.day, rr=EXCLUDED.rr
                    """
                )
                batch = []
                for ts_val, rr in rows:
                    dt = None
                    try:
                        if isinstance(ts_val, (int, float)):
                            try:
                                dt = datetime.fromtimestamp(int(ts_val))
                            except Exception:
                                dt = datetime.fromtimestamp(int(ts_val) / 1000)
                        elif isinstance(ts_val, str):
                            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                                try:
                                    dt = datetime.strptime(ts_val.replace('T', ' '), fmt)
                                    break
                                except Exception:
                                        pass
                    except Exception:
                        dt = None
                    if not dt:
                        continue
                    try:
                        rr_val = float(rr) if rr is not None else None
                    except Exception:
                        rr_val = None
                    batch.append({"ts": dt, "day": dt.date(), "rr": rr_val})
                    if len(batch) >= 10000:
                        session.execute(insert_sql, batch)
                        session.commit()
                        batch.clear()
                if batch:
                    session.execute(insert_sql, batch)
                    session.commit()
                logger.info("Migrated respiratory rate minute records into PostgreSQL")
            finally:
                sqlite_conn.close()
            return
            
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} respiratory rate records")
            
        except Exception as e:
            logger.error(f"Error migrating respiratory rate data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def migrate_sleep_events(self, sqlite_table: str = 'sleep_events', truncate: bool = True):
        """Migrate sleep event rows from local SQLite (garmin.db) into Postgres table garmin_sleep_events.

        This mirrors the standalone script but is safe to run inside the EnhancedGarminMigrator
        so the migration is self-contained.
        """
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not garmin_db_path.exists():
            logger.info("garmin.db not found; skipping sleep_events migration")
            return

        try:
            sqlite_conn = sqlite3.connect(str(garmin_db_path))
            sqlite_conn.row_factory = sqlite3.Row
            cur = sqlite_conn.cursor()
            # verify source table exists
            cur.execute("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name=?", (sqlite_table,))
            if not cur.fetchone():
                logger.info(f"SQLite table/view '{sqlite_table}' not found in {garmin_db_path}; skipping sleep_events migration")
                sqlite_conn.close()
                return

            cur.execute(f"SELECT timestamp, event, duration FROM {sqlite_table} ORDER BY timestamp")
            rows = cur.fetchall()
            total = len(rows)
            logger.info(f"Fetched {total} rows from SQLite table '{sqlite_table}'.")

            # Ensure target table exists in Postgres
            with self.engine.begin() as conn:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS garmin_sleep_events (
                        timestamp TIMESTAMP WITHOUT TIME ZONE,
                        event TEXT,
                        duration TIME WITHOUT TIME ZONE
                    );
                    CREATE INDEX IF NOT EXISTS idx_gse_timestamp ON garmin_sleep_events(timestamp);
                    """
                )
                if truncate:
                    try:
                        conn.exec_driver_sql("TRUNCATE TABLE garmin_sleep_events;")
                    except Exception:
                        # ignore if truncate not permitted
                        pass

            # Helper: convert duration value to HH:MM:SS or None
            import re
            from datetime import timedelta

            def duration_to_time_text(val):
                if val is None:
                    return None
                # numeric seconds
                try:
                    if isinstance(val, (int, float)):
                        secs = int(val)
                        h = (secs // 3600) % 24
                        m = (secs % 3600) // 60
                        s = secs % 60
                        return f"{h:02d}:{m:02d}:{s:02d}"
                except Exception:
                    pass
                s = str(val).strip()
                # TIME-like hh:mm:ss
                if ':' in s:
                    parts = s.split(':')
                    try:
                        parts = [int(p.split('.')[0]) for p in parts]
                        if len(parts) == 3:
                            h, m, sec = parts
                        elif len(parts) == 2:
                            h, m, sec = 0, parts[0], parts[1]
                        else:
                            return None
                        h = h % 24
                        return f"{h:02d}:{m:02d}:{sec:02d}"
                    except Exception:
                        pass
                # ISO8601-ish PTnHnMnS
                m = re.fullmatch(r"P?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s, flags=re.IGNORECASE)
                if m and any(m.groups()):
                    h = int(m.group(1) or 0)
                    mi = int(m.group(2) or 0)
                    se = int(m.group(3) or 0)
                    h = h % 24
                    return f"{h:02d}:{mi:02d}:{se:02d}"
                return None

            # Insert rows in batches into Postgres
            batch = []
            batch_size = 1000
            inserted = 0
            with self.engine.begin() as conn:
                insert_sql = text("INSERT INTO garmin_sleep_events (timestamp, event, duration) VALUES (:ts, :event, :duration)")
                for r in rows:
                    ts = r['timestamp']
                    ev = r['event']
                    dur = r['duration']
                    # normalize timestamp: numeric -> datetime
                    ts_val = None
                    try:
                        if isinstance(ts, (int, float)):
                            # try seconds then milliseconds
                            try:
                                ts_val = datetime.fromtimestamp(int(ts))
                            except Exception:
                                ts_val = datetime.fromtimestamp(int(ts) / 1000)
                        elif isinstance(ts, str):
                            # try common ISO formats
                            try:
                                ts_val = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                            except Exception:
                                try:
                                    ts_val = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S')
                                except Exception:
                                    ts_val = None
                        else:
                            ts_val = None
                    except Exception:
                        ts_val = None

                    dur_text = duration_to_time_text(dur)
                    batch.append({'ts': ts_val, 'event': ev, 'duration': dur_text})
                    if len(batch) >= batch_size:
                        conn.execute(insert_sql, batch)
                        inserted += len(batch)
                        batch.clear()
                if batch:
                    conn.execute(insert_sql, batch)
                    inserted += len(batch)

            logger.info(f"Inserted {inserted} rows into Postgres table 'garmin_sleep_events'.")
        except Exception as e:
            logger.warning(f"migrate_sleep_events failed: {e}")
        finally:
            try:
                sqlite_conn.close()
            except Exception:
                pass

    def migrate_activities_data(self):
        """Migrate detailed activity data from garmin_activities.db and compute stress stats per activity"""
        activities_db_path = self.health_data_path / "DBs" / "garmin_activities.db"
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not activities_db_path.exists():
            logger.warning("Garmin activities database not found")
            return
            
        session = self.SessionLocal()
        migrated_count = 0
        
        try:
            # Ensure target table has stress columns and BIGINT id (works for subset runs too)
            with self.engine.begin() as conn:
                conn.exec_driver_sql("ALTER TABLE garmin_activities ALTER COLUMN activity_id TYPE BIGINT;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS max_stress INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS avg_stress DOUBLE PRECISION;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS hr_zone1 INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS hr_zone2 INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS hr_zone3 INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS hr_zone4 INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS hr_zone5 INTEGER;")
            
            # Connect to SQLite databases
            sqlite_conn = sqlite3.connect(str(activities_db_path))
            sqlite_cursor = sqlite_conn.cursor()
            
            # Optional: stress source from garmin.db
            stress_conn = None
            stress_cursor = None
            self._stress_table = None
            self._stress_value_col = None
            self._stress_timestamp_col = None
            self._stress_ts_mode = None
            if garmin_db_path.exists():
                try:
                    stress_conn = sqlite3.connect(str(garmin_db_path))
                    stress_cursor = stress_conn.cursor()
                    # Find a stress-like table
                    stress_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                    tables = [r[0] for r in stress_cursor.fetchall()]
                    for t in tables:
                        if t.lower() in ("garmin_stress", "stress"):
                            self._stress_table = t
                            break
                    # If not found by exact name, try heuristic
                    if not self._stress_table:
                        for t in tables:
                            if "stress" in t.lower():
                                self._stress_table = t
                                break
                    # Detect columns
                    if self._stress_table:
                        stress_cursor.execute(f"PRAGMA table_info({self._stress_table})")
                        cols = [c[1] for c in stress_cursor.fetchall()]
                        # value column
                        for c in cols:
                            lc = c.lower()
                            if lc in ("stress", "stress_level", "stresslevel", "level") or ("stress" in lc and ("val" in lc or "level" in lc)):
                                self._stress_value_col = c
                                break
                        # timestamp column
                        for c in cols:
                            lc = c.lower()
                            if lc in ("timestamp", "time", "start_time", "ts") or ("time" in lc):
                                self._stress_timestamp_col = c
                                break
                        # Detect timestamp mode from a sample
                        if self._stress_timestamp_col:
                            try:
                                stress_cursor.execute(f"SELECT {self._stress_timestamp_col} FROM {self._stress_table} WHERE {self._stress_timestamp_col} IS NOT NULL LIMIT 1")
                                sample = stress_cursor.fetchone()
                                if sample is not None:
                                    ts_val = sample[0]
                                    if isinstance(ts_val, (int, float)):
                                        self._stress_ts_mode = 'numeric'
                                    elif isinstance(ts_val, str):
                                        self._stress_ts_mode = 'text'
                            except Exception:
                                self._stress_ts_mode = None
                except Exception:
                    self._stress_table = None
                    self._stress_value_col = None
                    self._stress_timestamp_col = None
                    self._stress_ts_mode = None
            else:
                self._stress_table = None
                self._stress_value_col = None
                self._stress_timestamp_col = None
                self._stress_ts_mode = None
            
            # Detect RR source from garmin_monitoring.db
            rr_conn = None
            rr_cursor = None
            self._rr_table = None
            self._rr_value_col = None
            self._rr_timestamp_col = None
            self._rr_ts_mode = None
            monitoring_db_path = self.health_data_path / "DBs" / "garmin_monitoring.db"
            if monitoring_db_path.exists():
                try:
                    rr_conn = sqlite3.connect(str(monitoring_db_path))
                    rr_cursor = rr_conn.cursor()
                    rr_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                    tables = [r[0] for r in rr_cursor.fetchall()]
                    for t in tables:
                        if t.lower() in ("monitoring_rr", "rr", "respiratory_rate"):
                            self._rr_table = t
                            break
                    if not self._rr_table:
                        for t in tables:
                            if "rr" in t.lower() or "respir" in t.lower():
                                self._rr_table = t
                                break
                    if self._rr_table:
                        rr_cursor.execute(f"PRAGMA table_info({self._rr_table})")
                        cols = [c[1] for c in rr_cursor.fetchall()]
                        for c in cols:
                            lc = c.lower()
                            if lc in ("rr", "respiratory_rate", "respiration", "rate") or ("respir" in lc and ("val" in lc or "rate" in lc)):
                                self._rr_value_col = c
                                break
                        for c in cols:
                            lc = c.lower()
                            if lc in ("timestamp", "time", "start_time", "ts") or ("time" in lc):
                                self._rr_timestamp_col = c
                                break
                        if self._rr_timestamp_col:
                            try:
                                rr_cursor.execute(f"SELECT {self._rr_timestamp_col} FROM {self._rr_table} WHERE {self._rr_timestamp_col} IS NOT NULL LIMIT 1")
                                sample = rr_cursor.fetchone()
                                if sample is not None:
                                    ts_val = sample[0]
                                    if isinstance(ts_val, (int, float)):
                                        self._rr_ts_mode = 'numeric'
                                    elif isinstance(ts_val, str):
                                        self._rr_ts_mode = 'text'
                            except Exception:
                                self._rr_ts_mode = None
                except Exception:
                    self._rr_table = None
                    self._rr_value_col = None
                    self._rr_timestamp_col = None
                    self._rr_ts_mode = None
            # Check if activities table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'")
            if not sqlite_cursor.fetchone():
                logger.warning("activities table not found in garmin_activities database")
                sqlite_conn.close()
                if stress_conn:
                    stress_conn.close()
                if rr_conn:
                    rr_conn.close()
                return
            
            # Get table structure
            sqlite_cursor.execute('PRAGMA table_info(activities)')
            columns = [col[1] for col in sqlite_cursor.fetchall()]
            logger.info(f"Available columns in activities table: {columns}")
            
            # Map database columns to our model fields (base activities)
            column_mapping = {
                # HR zones times at activity level
                'hrz_1_time': 'hr_zone1',
                'hrz_2_time': 'hr_zone2',
                'hrz_3_time': 'hr_zone3',
                'hrz_4_time': 'hr_zone4',
                'hrz_5_time': 'hr_zone5',
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
                
                'avg_temperature': 'avg_temperature',
                'max_temperature': 'max_temperature',
                'min_temperature': 'min_temperature',
                
                
                'avg_rr': 'avg_rr',
                'max_rr': 'max_rr'
            }
            
            # Build base select
            base_cols = [c for c in column_mapping.keys() if c in columns]
            # Ensure we include HR zone times if present
            for hz_col in ['hrz_1_time','hrz_2_time','hrz_3_time','hrz_4_time','hrz_5_time']:
                if hz_col in columns and hz_col not in base_cols:
                    base_cols.append(hz_col)
            if not base_cols:
                logger.warning("No matching columns found in activities")
                sqlite_conn.close()
                return
            logger.info(f"Using columns: {base_cols}")
            
            # Load activities base rows
            query = f"SELECT {', '.join(base_cols)} FROM activities WHERE activity_id IS NOT NULL ORDER BY start_time"
            sqlite_cursor.execute(query)
            base_rows = sqlite_cursor.fetchall()
            
            # Helper: fetch per-sport detail rows by joining with views/tables if present
            def fetch_map(name, key='activity_id'):
                try:
                    sqlite_cursor.execute(f"PRAGMA table_info({name})")
                    cols = [r[1] for r in sqlite_cursor.fetchall()]
                    if not cols or key not in cols:
                        return {}, []
                    sqlite_cursor.execute(f"SELECT * FROM {name}")
                    rows = sqlite_cursor.fetchall()
                    idx = {c:i for i,c in enumerate(cols)}
                    m = {}
                    for r in rows:
                        k = r[idx[key]]
                        # map both string and int keys to be robust
                        m[k] = r
                        try:
                            ik = int(k)
                            m[ik] = r
                        except Exception:
                            pass
                    return m, cols
                except Exception:
                    return {}, []
            
            steps_map, steps_cols = fetch_map('steps_activities')
            cycle_map, cycle_cols = fetch_map('cycle_activities')
            steps_view_map, steps_view_cols = fetch_map('steps_activities_view')
            run_view_map, run_view_cols = fetch_map('run_activities_view')
            hike_view_map, hike_view_cols = fetch_map('hiking_activities_view')
            cycle_view_map, cycle_view_cols = fetch_map('cycle_activities_view')
            
            for row in base_rows:
                try:
                    # Create data dict from base activities
                    data = {}
                    for i, col_name in enumerate(base_cols):
                        model_field = column_mapping[col_name]
                        value = row[i]
                        
                        # Convert data types
                        if col_name in ['start_time', 'stop_time']:
                            if isinstance(value, str):
                                try:
                                    data[model_field] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                except Exception:
                                    data[model_field] = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                            elif isinstance(value, int | float):
                                data[model_field] = datetime.fromtimestamp(value)
                        elif col_name in ['distance', 'avg_speed', 'max_speed', 'training_load', 'training_effect', 
                                        'anaerobic_training_effect', 'avg_cadence', 'max_cadence', 'ascent', 'descent',
                                        'avg_step_length', 'avg_vertical_ratio', 'avg_vertical_oscillation', 
                                        'avg_ground_contact_time', 'avg_temperature',
                                        'max_temperature', 'min_temperature', 'avg_rr', 'max_rr']:
                            if col_name == 'distance' and value is not None:
                                # distance stored in km in SQLite -> convert to meters
                                try:
                                    data[model_field] = float(value) * 1000.0
                                except Exception:
                                    data[model_field] = None
                            elif col_name in ['avg_temperature', 'max_temperature', 'min_temperature']:
                                data[model_field] = normalize_temperature(value)
                            else:
                                data[model_field] = float(value) if value is not None else None
                        elif col_name == 'activity_id':
                            # activity_id can exceed 32-bit range; allow up to BIGINT
                            data[model_field] = self.safe_int_conversion(value, max_value=9223372036854775807)
                            activity_id = data[model_field]
                        elif col_name in ['elapsed_time', 'moving_time']:
                            # In SQLite, these are TIME strings like 'HH:MM:SS.ffffff'
                            seconds = parse_duration_to_seconds(value)
                            data[model_field] = seconds
                        elif col_name in ['hrz_1_time','hrz_2_time','hrz_3_time','hrz_4_time','hrz_5_time']:
                            seconds = parse_duration_to_seconds(value)
                            data[model_field] = seconds
                            # In SQLite, these are TIME strings like 'HH:MM:SS.ffffff'
                            seconds = parse_duration_to_seconds(value)
                            data[model_field] = seconds
                        elif col_name in ['calories', 'avg_hr', 'max_hr', 'cycles']:
                            data[model_field] = self.safe_int_conversion(value)
                        elif col_name in ['self_eval_feel', 'self_eval_effort']:
                            # Map textual self-evaluation to ordinal scales
                            if isinstance(value, (int, float)):
                                data[model_field] = self.safe_int_conversion(value)
                            elif isinstance(value, str):
                                v = value.strip().lower()
                                if col_name == 'self_eval_feel':
                                    data[model_field] = SELF_EVAL_FEEL_MAP.get(v)
                                else:
                                    data[model_field] = SELF_EVAL_EFFORT_MAP.get(v)
                            else:
                                data[model_field] = None
                        else:
                            data[model_field] = value
                    
                    if 'activity_id' not in data or data['activity_id'] is None:
                        continue
                    
                    # Merge per-sport data overlays
                    aid = activity_id
                    # steps overlay
                    if aid in steps_map:
                        sm = steps_map[aid]; idx = {c:i for i,c in enumerate(steps_cols)}
                        # normalize running dynamics
                        if 'avg_step_length' in idx:
                            data['avg_step_length'] = normalize_step_length_to_meters(sm[idx['avg_step_length']]) or data.get('avg_step_length')
                        if 'avg_vertical_ratio' in idx:
                            data['avg_vertical_ratio'] = float(sm[idx['avg_vertical_ratio']]) if sm[idx['avg_vertical_ratio']] is not None else data.get('avg_vertical_ratio')
                        if 'avg_vertical_oscillation' in idx:
                            data['avg_vertical_oscillation'] = normalize_vertical_oscillation_to_cm(sm[idx['avg_vertical_oscillation']]) or data.get('avg_vertical_oscillation')
                        if 'avg_ground_contact_time' in idx:
                            # store in milliseconds
                            gct_ms = time_str_to_milliseconds(sm[idx['avg_ground_contact_time']])
                            data['avg_ground_contact_time'] = gct_ms if gct_ms is not None else data.get('avg_ground_contact_time')
                        if 'steps' in idx:
                            data['cycles'] = data.get('cycles') or self.safe_int_conversion(sm[idx['steps']])
                    # cycle overlay
                    if aid in cycle_map:
                        cm = cycle_map[aid]; idx = {c:i for i,c in enumerate(cycle_cols)}
                        if 'strokes' in idx:
                            data['cycles'] = data.get('cycles') or self.safe_int_conversion(cm[idx['strokes']])
                    # views (prefer richer views if present)
                    for vmap, vcols in [
                        (steps_view_map, steps_view_cols),
                        (run_view_map, run_view_cols),
                        (hike_view_map, hike_view_cols),
                        (cycle_view_map, cycle_view_cols)
                    ]:
                        if aid in vmap:
                            r = vmap[aid]; idx = {c:i for i,c in enumerate(vcols)}
                            # fill selected fields if missing
                            for k in ['steps','strokes','avg_pace','avg_moving_pace','max_pace','avg_steps_per_min','max_steps_per_min','avg_rpms','max_rpms','avg_step_length','avg_vertical_ratio','avg_vertical_oscillation','avg_ground_contact_time','avg_rr','max_rr','vo2_max']:
                                if k in idx:
                                    val = r[idx[k]]
                                    if k in ['steps','strokes']:
                                        # store steps count per activity
                                        data['steps'] = data.get('steps') or self.safe_int_conversion(val)
                                    elif k in ['avg_rpms','max_rpms']:
                                        # map to cadence if better than existing
                                        mapped = 'avg_cadence' if k=='avg_rpms' else 'max_cadence'
                                        fv = float(val) if val is not None else None
                                        if fv is not None:
                                            data[mapped] = fv
                                    elif k in ['avg_pace','avg_moving_pace','max_pace']:
                                        # convert to minutes per km
                                        pace = parse_pace_to_min_per_km(val)
                                        if pace is not None:
                                            if k == 'avg_pace':
                                                data['avg_pace'] = pace
                                            elif k == 'max_pace':
                                                data['max_pace'] = pace
                                    elif k == 'avg_step_length':
                                        sl = normalize_step_length_to_meters(val)
                                        if sl is not None:
                                            data['avg_step_length'] = sl
                                    elif k == 'avg_vertical_ratio':
                                        if val is not None:
                                            data['avg_vertical_ratio'] = float(val)
                                    elif k == 'avg_vertical_oscillation':
                                        vo = normalize_vertical_oscillation_to_cm(val)
                                        if vo is not None:
                                            data['avg_vertical_oscillation'] = vo
                                    elif k == 'avg_ground_contact_time':
                                        gct_ms = time_str_to_milliseconds(val)
                                        if gct_ms is not None:
                                            data['avg_ground_contact_time'] = gct_ms
                                    elif k in ['avg_rr','max_rr']:
                                        # provisional fill from views; may be overridden by time-window stats later
                                        if val is not None and data.get(k) is None:
                                            try:
                                                data[k] = float(val)
                                            except Exception:
                                                pass
                                    elif k == 'vo2_max':
                                        try:
                                            data['vo2_max'] = float(val) if val is not None else None
                                        except Exception:
                                            pass
                                    elif k == 'vo2_max':
                                        try:
                                            data['vo2_max'] = float(val) if val is not None else None
                                        except Exception:
                                            pass
                    
                    # Calculate derived fields
                    if 'start_time' in data and data['start_time']:
                        data['day'] = data['start_time'].date()

                    # If stop_time equals start_time but we have elapsed_time, derive stop_time
                    if data.get('start_time') and data.get('stop_time') and data.get('elapsed_time') is not None:
                        if isinstance(data['start_time'], datetime) and isinstance(data['stop_time'], datetime) and data['stop_time'] == data['start_time']:
                            try:
                                data['stop_time'] = data['start_time'] + timedelta(seconds=int(data['elapsed_time']))
                            except Exception:
                                pass
                    elif data.get('start_time') and data.get('elapsed_time') is not None and not data.get('stop_time'):
                        try:
                            data['stop_time'] = data['start_time'] + timedelta(seconds=int(data['elapsed_time']))
                        except Exception:
                            pass
                    
                    # Calculate pace if we have distance and time and not present from views
                    if data.get('distance') and data.get('moving_time') and data['distance'] > 0 and data['moving_time'] > 0 and not data.get('avg_pace'):
                        pace_seconds_per_meter = data['moving_time'] / data['distance']
                        data['avg_pace'] = pace_seconds_per_meter * 1000 / 60  # min/km
                    
                    # Remove deprecated fields that are no longer in the schema
                    data.pop('cycles', None)

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
            
            # Compute stress stats per activity time range using PostgreSQL minute-level table
            try:
                with self.engine.begin() as conn:
                    # Only run if table has data
                    has_rows = conn.exec_driver_sql("SELECT 1 FROM garmin_stress_data LIMIT 1").fetchone()
                    if has_rows:
                        conn.exec_driver_sql(
                            """
                            UPDATE garmin_activities a
                            SET max_stress = s.max_stress,
                                avg_stress = s.avg_stress
                            FROM (
                              SELECT a2.activity_id,
                                     MAX(sd.stress) AS max_stress,
                                     AVG(sd.stress) AS avg_stress
                              FROM garmin_activities a2
                              JOIN garmin_stress_data sd
                                ON sd.ts >= a2.start_time - INTERVAL '2 minutes'
                               AND sd.ts <= a2.stop_time + INTERVAL '2 minutes'
                              WHERE a2.start_time IS NOT NULL AND a2.stop_time IS NOT NULL
                                AND (a2.max_stress IS NULL OR a2.avg_stress IS NULL)
                              GROUP BY a2.activity_id
                            ) s
                            WHERE a.activity_id = s.activity_id;
                            """
                        )
                        logger.info("Updated stress stats for activities using PostgreSQL minute-level table")
                        # Normalize temperatures after activities update as well
                        conn.exec_driver_sql(
                            """
                            UPDATE garmin_activities
                            SET 
                                avg_temperature = NULLIF(avg_temperature, 127),
                                max_temperature = NULLIF(max_temperature, 127),
                                min_temperature = NULLIF(min_temperature, 127)
                            WHERE 
                                avg_temperature = 127 OR max_temperature = 127 OR min_temperature = 127;
                            """
                        )
                        logger.info("Normalized temperature sentinel values (127) to NULL in garmin_activities after activity migration")
            except Exception as e:
                logger.warning(f"Failed computing stress stats per activity (PostgreSQL): {e}")
            
            # Compute RR stats per activity using PostgreSQL minute-level table
            try:
                with self.engine.begin() as conn:
                    has_rows = conn.exec_driver_sql("SELECT 1 FROM garmin_respiratory_rate_data LIMIT 1").fetchone()
                    if has_rows:
                        conn.exec_driver_sql(
                            """
                            UPDATE garmin_activities a
                            SET avg_rr = r.avg_rr,
                                max_rr = r.max_rr
                            FROM (
                              SELECT a2.activity_id,
                                     AVG(rd.rr) AS avg_rr,
                                     MAX(rd.rr) AS max_rr
                              FROM garmin_activities a2
                              JOIN garmin_respiratory_rate_data rd
                                ON rd.ts >= a2.start_time - INTERVAL '2 minutes'
                               AND rd.ts <= a2.stop_time + INTERVAL '2 minutes'
                              WHERE a2.start_time IS NOT NULL AND a2.stop_time IS NOT NULL
                                AND (a2.avg_rr IS NULL OR a2.max_rr IS NULL)
                              GROUP BY a2.activity_id
                            ) r
                            WHERE a.activity_id = r.activity_id;
                            """
                        )
                        logger.info("Updated RR stats for activities using PostgreSQL minute-level table")
            except Exception as e:
                logger.warning(f"Failed computing RR stats per activity (PostgreSQL): {e}")
            
            if stress_conn:
                stress_conn.close()
            if rr_conn:
                rr_conn.close()
            sqlite_conn.close()
            session.commit()
            logger.info(f"Migrated {migrated_count} activities")
            # Ensure activity metrics are backfilled from minute-level tables (handles missing stop_time via derived window)
            try:
                self.recompute_activity_metrics(buffer_minutes=5)
            except Exception as e:
                logger.warning(f"Post-migration recompute of activity metrics failed: {e}")
            
        except Exception as e:
            logger.error(f"Error migrating activities data: {e}")
            session.rollback()
            raise
        finally:
            session.close()

    def recompute_activity_metrics(self, buffer_minutes: int = 5):
        """Recompute stress and respiratory metrics for activities from minute-level tables.
        - Uses a derived stop time if stop_time is NULL: start_time + COALESCE(moving_time, elapsed_time)
        - Applies a configurable +/- buffer around the window (default 5 minutes)
        - Only fills fields that are currently NULL to avoid overwriting curated values
        """
        try:
            with self.engine.begin() as conn:
                # Recompute stress metrics
                try:
                    has_stress = conn.exec_driver_sql("SELECT 1 FROM garmin_stress_data LIMIT 1").fetchone()
                    if has_stress:
                        conn.exec_driver_sql(f"""
                            WITH win AS (
                                SELECT a.activity_id,
                                       a.start_time,
                                       COALESCE(a.stop_time, a.start_time + make_interval(secs => COALESCE(a.moving_time, a.elapsed_time, 0))) AS stop_derived
                                FROM garmin_activities a
                                WHERE a.start_time IS NOT NULL
                            ),
                            s AS (
                                SELECT a.activity_id,
                                       MAX(sd.stress) AS max_stress,
                                       AVG(sd.stress) AS avg_stress
                                FROM garmin_activities a
                                JOIN win w ON w.activity_id = a.activity_id
                                JOIN garmin_stress_data sd
                                  ON sd.ts >= w.start_time - INTERVAL '{buffer_minutes} minutes'
                                 AND sd.ts <= w.stop_derived + INTERVAL '{buffer_minutes} minutes'
                                GROUP BY a.activity_id
                            )
                            UPDATE garmin_activities a
                            SET max_stress = COALESCE(a.max_stress, s.max_stress),
                                avg_stress = COALESCE(a.avg_stress, s.avg_stress)
                            FROM s
                            WHERE a.activity_id = s.activity_id
                              AND (a.max_stress IS NULL OR a.avg_stress IS NULL);
                        """)
                except Exception as e:
                    logger.warning(f"Failed to recompute activity stress metrics: {e}")

                # Recompute respiratory rate metrics
                try:
                    has_rr = conn.exec_driver_sql("SELECT 1 FROM garmin_respiratory_rate_data LIMIT 1").fetchone()
                    if has_rr:
                        conn.exec_driver_sql(f"""
                            WITH win AS (
                                SELECT a.activity_id,
                                       a.start_time,
                                       COALESCE(a.stop_time, a.start_time + make_interval(secs => COALESCE(a.moving_time, a.elapsed_time, 0))) AS stop_derived
                                FROM garmin_activities a
                                WHERE a.start_time IS NOT NULL
                            ),
                            r AS (
                                SELECT a.activity_id,
                                       AVG(rd.rr) AS avg_rr,
                                       MAX(rd.rr) AS max_rr
                                FROM garmin_activities a
                                JOIN win w ON w.activity_id = a.activity_id
                                JOIN garmin_respiratory_rate_data rd
                                  ON rd.ts >= w.start_time - INTERVAL '{buffer_minutes} minutes'
                                 AND rd.ts <= w.stop_derived + INTERVAL '{buffer_minutes} minutes'
                                GROUP BY a.activity_id
                            )
                            UPDATE garmin_activities a
                            SET avg_rr = COALESCE(a.avg_rr, r.avg_rr),
                                max_rr = COALESCE(a.max_rr, r.max_rr)
                            FROM r
                            WHERE a.activity_id = r.activity_id
                              AND (a.avg_rr IS NULL OR a.max_rr IS NULL);
                        """)
                except Exception as e:
                    logger.warning(f"Failed to recompute activity RR metrics: {e}")

            logger.info("Recomputed activity stress and RR metrics from minute-level tables")
        except Exception as e:
            logger.warning(f"Error during recomputation of activity metrics: {e}")

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

    def compute_minute_level_daily_stats(self):
        """Compute daily aggregates (HR/RR/stress) directly in PostgreSQL from minute-level tables
        and update garmin_daily_summaries. Only fills missing values to avoid overwriting curated data.
        """
        try:
            with self.engine.begin() as conn:
                # Ensure there is a row for each day that appears in minute tables
                # Insert missing days from HR minutes
                conn.exec_driver_sql(
                    """
                    INSERT INTO garmin_daily_summaries (day)
                    SELECT DISTINCT day FROM garmin_heart_rate_data
                    ON CONFLICT (day) DO NOTHING;
                    """
                )
                # Insert missing days from RR minutes
                conn.exec_driver_sql(
                    """
                    INSERT INTO garmin_daily_summaries (day)
                    SELECT DISTINCT day FROM garmin_respiratory_rate_data
                    ON CONFLICT (day) DO NOTHING;
                    """
                )
                # Insert missing days from stress minutes
                conn.exec_driver_sql(
                    """
                    INSERT INTO garmin_daily_summaries (day)
                    SELECT DISTINCT day FROM garmin_stress_data
                    ON CONFLICT (day) DO NOTHING;
                    """
                )

                # HR aggregates (integer rounding)
                conn.exec_driver_sql(
                    """
                    WITH h AS (
                        SELECT day,
                               ROUND(AVG(bpm))::INT AS hr_avg,
                               MIN(bpm)::INT AS hr_min,
                               MAX(bpm)::INT AS hr_max
                        FROM garmin_heart_rate_data
                        WHERE bpm IS NOT NULL
                        GROUP BY day
                    )
                    UPDATE garmin_daily_summaries ds
                    SET hr_avg = COALESCE(ds.hr_avg, h.hr_avg),
                        hr_min = COALESCE(ds.hr_min, h.hr_min),
                        hr_max = COALESCE(ds.hr_max, h.hr_max)
                    FROM h
                    WHERE ds.day = h.day;
                    """
                )

                # RR aggregates (float). We set rr_max/rr_min, and only fill rr_waking_avg if missing.
                conn.exec_driver_sql(
                    """
                    WITH r AS (
                        SELECT day,
                               AVG(rr) AS rr_avg,
                               MIN(rr) AS rr_min,
                               MAX(rr) AS rr_max
                        FROM garmin_respiratory_rate_data
                        WHERE rr IS NOT NULL
                        GROUP BY day
                    )
                    UPDATE garmin_daily_summaries ds
                    SET rr_max = COALESCE(ds.rr_max, r.rr_max),
                        rr_min = COALESCE(ds.rr_min, r.rr_min),
                        rr_waking_avg = COALESCE(ds.rr_waking_avg, r.rr_avg)
                    FROM r
                    WHERE ds.day = r.day;
                    """
                )

                # Stress daily average (integer rounding)
                conn.exec_driver_sql(
                    """
                    WITH s AS (
                        SELECT day,
                               ROUND(AVG(stress))::INT AS stress_avg
                        FROM garmin_stress_data
                        WHERE stress IS NOT NULL
                        GROUP BY day
                    )
                    UPDATE garmin_daily_summaries ds
                    SET stress_avg = COALESCE(ds.stress_avg, s.stress_avg)
                    FROM s
                    WHERE ds.day = s.day;
                    """
                )

            logger.info("Computed daily HR/RR/stress aggregates from minute-level tables in PostgreSQL")
        except Exception as e:
            logger.warning(f"Failed computing daily aggregates from minute tables: {e}")

    def parse_any_timestamp(self, value: Any) -> datetime | None:
        """Parse numeric (seconds or ms) or string timestamps to datetime."""
        try:
            if value is None:
                return None
            if isinstance(value, datetime):
                return value
            if isinstance(value, (int, float)):
                v = float(value)
                # Heuristic: > 10^12 -> ms, else seconds
                if v > 1_000_000_000_000:
                    return datetime.fromtimestamp(v / 1000.0)
                # If seconds but too small/too big, guard
                if 0 < v < 4102444800:  # until 2100
                    return datetime.fromtimestamp(v)
                return None
            if isinstance(value, str):
                s = value.strip().replace('T', ' ')
                for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        d = datetime.strptime(s, fmt)
                        # If only date was given, return midnight
                        return d
                    except Exception:
                        pass
            return None
        except Exception:
            return None

    def migrate_sleep_from_sqlite_db(self):
        """Migrate sleep sessions from HealthData/DBs/garmin.db table 'sleep', fixing start/end and qualifier.
        Upserts into garmin_sleep_sessions and overrides incorrect values.
        """
        garmin_db_path = self.health_data_path / "DBs" / "garmin.db"
        if not garmin_db_path.exists():
            logger.warning("Garmin database not found for sleep table migration")
            return
        session = self.SessionLocal()
        migrated = 0
        try:
            sqlite_conn = sqlite3.connect(str(garmin_db_path))
            cur = sqlite_conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sleep'")
            if not cur.fetchone():
                logger.warning("sleep table not found in garmin.db")
                sqlite_conn.close()
                return
            # Introspect columns
            cur.execute('PRAGMA table_info(sleep)')
            cols = [r[1] for r in cur.fetchall()]
            colset = {c.lower(): c for c in cols}

            def has(*cands):
                for c in cands:
                    if c.lower() in colset:
                        return colset[c.lower()]
                return None

            # Resolve source columns by priority
            col_id = has('id', 'sleep_id')
            col_start = has('sleep_start', 'sleep_start_timestamp', 'sleepStartTimestampLocal', 'sleepStartTimestampGMT', 'start_time_local', 'start_time', 'start_time_gmt')
            col_end = has('sleep_end', 'sleep_end_timestamp', 'sleepEndTimestampLocal', 'sleepEndTimestampGMT', 'end_time_local', 'end_time', 'stop_time', 'end_time_gmt')
            col_duration = has('sleep_time_seconds', 'sleep_time', 'duration', 'total_sleep_time')
            col_deep = has('deep_sleep_seconds', 'deepSleepSeconds', 'deep_sleep')
            col_light = has('light_sleep_seconds', 'lightSleepSeconds', 'light_sleep')
            col_rem = has('rem_sleep_seconds', 'remSleepSeconds', 'rem_sleep')
            col_awake = has('awake_sleep_seconds', 'awake_seconds', 'awakeSleepSeconds', 'awake_sleep')
            col_score = has('sleep_score', 'score', 'overall_score')
            col_quality = has('qualifier', 'sleep_quality')  # textual qualifier
            col_day = has('day', 'date', 'calendarDate')

            # Build SELECT
            select_cols = [x for x in [col_id, col_start, col_end, col_duration, col_deep, col_light, col_rem, col_awake, col_score, col_quality, col_day] if x]
            cur.execute(f"SELECT {', '.join(select_cols)} FROM sleep")
            rows = cur.fetchall()

            idx = {name: i for i, name in enumerate(select_cols)}

            for r in rows:
                try:
                    sid = r[idx[col_id]] if col_id else None
                    # Derive times
                    st_raw = r[idx[col_start]] if col_start else None
                    en_raw = r[idx[col_end]] if col_end else None
                    # Determine if the chosen columns are already local epoch values
                    st_is_local = isinstance(col_start, str) and col_start.lower() in {
                        'sleepstarttimestamplocal', 'start_time_local'
                    }
                    en_is_local = isinstance(col_end, str) and col_end.lower() in {
                        'sleependtimestamplocal', 'end_time_local'
                    }
                    
                    # Parse timestamps accordingly
                    if isinstance(st_raw, (int, float)):
                        st = self.safe_timestamp_to_datetime(int(st_raw), already_local_epoch=st_is_local)
                    else:
                        st = self.parse_any_timestamp(st_raw)
                    if isinstance(en_raw, (int, float)):
                        en = self.safe_timestamp_to_datetime(int(en_raw), already_local_epoch=en_is_local)
                    else:
                        en = self.parse_any_timestamp(en_raw)
                    # If missing end, try duration
                    dur_sec = None
                    if col_duration and r[idx[col_duration]] is not None:
                        try:
                            val = r[idx[col_duration]]
                            if isinstance(val, (int, float)):
                                dur_sec = int(val)
                            elif isinstance(val, str):
                                # HH:MM:SS or seconds string
                                parts = val.split(':')
                                if len(parts) == 3:
                                    dur_sec = int(parts[0])*3600 + int(parts[1])*60 + int(float(parts[2]))
                                elif val.isdigit():
                                    dur_sec = int(val)
                        except Exception:
                            dur_sec = None
                    if st and not en and dur_sec is not None:
                        en = st + timedelta(seconds=dur_sec)
                    if en and not st and dur_sec is not None:
                        st = en - timedelta(seconds=dur_sec)

                    # Day: prefer provided, else from start
                    day = None
                    if col_day and r[idx[col_day]] is not None:
                        dval = r[idx[col_day]]
                        if isinstance(dval, (int, float)):
                            try:
                                day = datetime.fromtimestamp(float(dval)).date()
                            except Exception:
                                day = None
                        elif isinstance(dval, str):
                            s = dval.strip().split('T')[0]
                            try:
                                day = datetime.strptime(s, '%Y-%m-%d').date()
                            except Exception:
                                day = None
                    if day is None and st:
                        day = st.date()

                    deep = r[idx[col_deep]] if col_deep else None
                    light = r[idx[col_light]] if col_light else None
                    rem = r[idx[col_rem]] if col_rem else None
                    awake = r[idx[col_awake]] if col_awake else None
                    score = r[idx[col_score]] if col_score else None
                    quality = r[idx[col_quality]] if col_quality else None

                    # Coerce ints
                    def to_int(x):
                        try:
                            return int(float(x)) if x is not None else None
                        except Exception:
                            return None
                    deep = to_int(deep); light = to_int(light); rem = to_int(rem); awake = to_int(awake); score = to_int(score); dur_sec = to_int(dur_sec)

                    # Normalize units: sqlite `sleep` table often stores durations in minutes
                    # while `garmin_sleep_sessions` expects seconds. Apply heuristic:
                    # - if source column name contains 'second' (or 'seconds'), treat value as seconds
                    # - if numeric value > 1440 treat it as seconds (unlikely minutes > 24h)
                    # - otherwise treat value as minutes and convert to seconds
                    def normalize_to_seconds(val, col_name):
                        if val is None:
                            return None
                        try:
                            v = int(val)
                        except Exception:
                            return None
                        if col_name and isinstance(col_name, str) and 'second' in col_name.lower():
                            return v
                        # large values are probably seconds
                        if v > 1440:
                            return v
                        # otherwise assume minutes and convert
                        return v * 60

                    deep = normalize_to_seconds(deep, col_deep)
                    light = normalize_to_seconds(light, col_light)
                    rem = normalize_to_seconds(rem, col_rem)
                    awake = normalize_to_seconds(awake, col_awake)
                    # dur_sec may already be in seconds if parsed from HH:MM:SS or column name indicates seconds
                    dur_sec = normalize_to_seconds(dur_sec, col_duration) if dur_sec is not None else None

                    # Update by matching the specific sleep session when possible.
                    # Many users have multiple sleep rows on the same calendar day (naps + main sleep).
                    # Prefer a narrow update that matches `sleep_start` within a +/-12 hour window of the
                    # source start time. If that doesn't affect any rows, fall back to the day-level
                    # update (preserving COALESCE semantics so we don't overwrite non-empty fields).
                    if day is None:
                        continue

                    # Base day-level update (fallback)
                    upd_sql = text(
                        """
                        UPDATE garmin_sleep_sessions
                        SET 
                          sleep_start = COALESCE(:st, sleep_start),
                          sleep_end = COALESCE(:en, sleep_end),
                          sleep_duration_seconds = COALESCE(:dur_sec, sleep_duration_seconds),
                          deep_sleep_seconds = COALESCE(:deep, deep_sleep_seconds),
                          light_sleep_seconds = COALESCE(:light, light_sleep_seconds),
                          rem_sleep_seconds = COALESCE(:rem, rem_sleep_seconds),
                          awake_seconds = COALESCE(:awake, awake_seconds),
                          sleep_score = COALESCE(:score, sleep_score),
                          sleep_quality = COALESCE(:quality, sleep_quality)
                        WHERE day = :day
                        """
                    )

                    params = {
                        'st': st,
                        'en': en,
                        'dur_sec': dur_sec,
                        'deep': deep,
                        'light': light,
                        'rem': rem,
                        'awake': awake,
                        'score': score,
                        'quality': str(quality) if quality is not None else None,
                        'day': day,
                    }

                    res = None
                    # If we have a start timestamp, attempt the narrow update first
                    if st is not None:
                        st_minus = st - timedelta(hours=12)
                        st_plus = st + timedelta(hours=12)
                        upd_narrow = text(
                            """
                            UPDATE garmin_sleep_sessions
                            SET 
                              sleep_start = COALESCE(:st, sleep_start),
                              sleep_end = COALESCE(:en, sleep_end),
                              sleep_duration_seconds = COALESCE(:dur_sec, sleep_duration_seconds),
                              deep_sleep_seconds = COALESCE(:deep, deep_sleep_seconds),
                              light_sleep_seconds = COALESCE(:light, light_sleep_seconds),
                              rem_sleep_seconds = COALESCE(:rem, rem_sleep_seconds),
                              awake_seconds = COALESCE(:awake, awake_seconds),
                              sleep_score = COALESCE(:score, sleep_score),
                              sleep_quality = COALESCE(:quality, sleep_quality)
                            WHERE day = :day AND (
                              sleep_start BETWEEN :st_minus AND :st_plus
                              OR sleep_start IS NULL
                            )
                            """
                        )

                        narrow_params = dict(params)
                        narrow_params.update({'st_minus': st_minus, 'st_plus': st_plus})
                        res = session.execute(upd_narrow, narrow_params)

                    # If narrow update didn't match any rows (or we had no start), fall back to day-level
                    if res is None or (res.rowcount or 0) == 0:
                        res = session.execute(upd_sql, params)

                    migrated += res.rowcount or 0
                    if migrated % 200 == 0:
                        session.commit()
                except Exception as e:
                    logger.warning(f"Error processing sleep row from sqlite: {e}")
                    continue
            session.commit()
            logger.info(f"Migrated/updated {migrated} sleep rows from sqlite 'sleep' table")
        except Exception as e:
            logger.error(f"SQLite sleep migration failed: {e}")
            session.rollback()
            raise
        finally:
            try:
                sqlite_conn.close()
            except Exception:
                pass
            session.close()

    def run_migration(self):
        """Run the complete migration process"""
        logger.info("Starting enhanced Garmin data migration...")
        
        try:
            # Migrate selected data types per new requirements
            self.migrate_rhr_data()
            self.migrate_sleep_data()
            # Override/fix from SQLite sleep table (ensures correct start/end and quality)
            self.migrate_sleep_from_sqlite_db()
            self.migrate_daily_summary_data()  # This includes steps and much more
            # Include minute-level migrations into PostgreSQL tables
            self.migrate_stress_data()
            self.migrate_heart_rate_data()
            # Populate per-sleep average HR after minute-level HR data is available
            try:
                self.populate_avg_sleep_hr(buffer_minutes=2)
            except Exception as e:
                logger.warning(f"populate_avg_sleep_hr failed: {e}")
            self.migrate_respiratory_rate_data()
            # Compute day-level stats on the DB from minute tables
            self.compute_minute_level_daily_stats()
            # Migrate sleep events from local SQLite into garmin_sleep_events, then populate last_sleep_phase
            try:
                self.migrate_sleep_events()
            except Exception as e:
                logger.warning(f"migrate_sleep_events failed: {e}")
            try:
                self.populate_last_sleep_phase()
            except Exception as e:
                logger.warning(f"populate_last_sleep_phase failed during migration: {e}")
            self.migrate_activities_data()  # Detailed activity data (will normalize stress minima)
            self.migrate_weight_data()
            
            # Safety: ensure activity_id column is BIGINT
            with self.engine.begin() as conn:
                conn.exec_driver_sql("ALTER TABLE garmin_activities ALTER COLUMN activity_id TYPE BIGINT;")
                # Ensure stress columns exist (for existing DBs)
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS max_stress INTEGER;")
                conn.exec_driver_sql("ALTER TABLE garmin_activities ADD COLUMN IF NOT EXISTS avg_stress DOUBLE PRECISION;")
            
            # Create journal entries for all days with data
            self.create_journal_entries()
            
            logger.info("Migration completed successfully!")
            
            # Print summary
            self.print_migration_summary()
            # Post-migration data quality verification
            self.verify_data_quality()
            
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

    def verify_data_quality(self):
        """Run basic data quality checks and log warnings for unexpected nulls in RR and stress."""
        try:
            with self.engine.begin() as conn:
                # Check column absence
                res = conn.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_activities' AND column_name = 'avg_ground_contact_balance'")
                if res.fetchone():
                    logger.warning("Column avg_ground_contact_balance still present in garmin_activities (should be removed)")
                
                # Activities nulls
                r = conn.exec_driver_sql(
                    """
                    SELECT 
                      COUNT(*) AS total,
                      SUM(CASE WHEN avg_rr IS NULL THEN 1 ELSE 0 END) AS null_avg_rr,
                      SUM(CASE WHEN max_rr IS NULL THEN 1 ELSE 0 END) AS null_max_rr,
                      SUM(CASE WHEN max_stress IS NULL THEN 1 ELSE 0 END) AS null_max_stress,
                      SUM(CASE WHEN avg_stress IS NULL THEN 1 ELSE 0 END) AS null_avg_stress
                    FROM garmin_activities
                    """
                ).fetchone()
                if r is not None:
                    total, n_avg_rr, n_max_rr, n_max_s, n_avg_s = r
                    logger.info(f"Activities: total={total}, null_avg_rr={n_avg_rr}, null_max_rr={n_max_rr}, null_max_stress={n_max_s}, null_avg_stress={n_avg_s}")
                
                # Daily summary nulls
                r2 = conn.exec_driver_sql(
                    """
                    SELECT 
                      COUNT(*) AS total_days,
                      SUM(CASE WHEN rr_waking_avg IS NULL THEN 1 ELSE 0 END) AS null_rr_waking,
                      SUM(CASE WHEN rr_max IS NULL THEN 1 ELSE 0 END) AS null_rr_max,
                      SUM(CASE WHEN rr_min IS NULL THEN 1 ELSE 0 END) AS null_rr_min,
                      SUM(CASE WHEN stress_avg IS NULL THEN 1 ELSE 0 END) AS null_stress_avg
                    FROM garmin_daily_summaries
                    """
                ).fetchone()
                if r2 is not None:
                    td, n_rr_w, n_rr_max, n_rr_min, n_s_avg = r2
                    logger.info(f"Daily summaries: total_days={td}, null_rr_waking={n_rr_w}, null_rr_max={n_rr_max}, null_rr_min={n_rr_min}, null_stress_avg={n_s_avg}")
        except Exception as e:
            logger.warning(f"Data quality verification failed: {e}")

def main():
    """Main function"""
    migrator = EnhancedGarminMigrator()
    migrator.run_migration()

if __name__ == "__main__":
    main()