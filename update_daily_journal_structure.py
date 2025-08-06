#!/usr/bin/env python3
"""
Update daily_journal table structure to comprehensive health tracking
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv('config.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection"""
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url)

def backup_existing_data(engine):
    """Backup existing daily_journal data"""
    logger.info("Backing up existing daily_journal data...")
    
    with engine.connect() as conn:
        # Create backup table
        conn.execute(text("""
            DROP TABLE IF EXISTS daily_journal_backup;
            CREATE TABLE daily_journal_backup AS 
            SELECT * FROM daily_journal;
        """))
        conn.commit()
        
        # Count backed up records
        result = conn.execute(text("SELECT COUNT(*) FROM daily_journal_backup"))
        count = result.scalar()
        logger.info(f"Backed up {count} existing journal entries")

def drop_old_table(engine):
    """Drop old daily_journal table"""
    logger.info("Dropping old daily_journal table...")
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS daily_journal CASCADE;"))
        conn.commit()

def create_new_daily_journal_table(engine):
    """Create new comprehensive daily_journal table"""
    logger.info("Creating new daily_journal table...")
    
    create_table_sql = """
    CREATE TABLE daily_journal (
        -- Klucz główny i relacje
        day                        DATE PRIMARY KEY,
        location                   VARCHAR(200),

        -- Nastrój i samopoczucie subiektywne (1–5)
        mood                       INTEGER CHECK (mood >= 1 AND mood <= 5),
        energy_level               INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
        stress_level_manual        INTEGER CHECK (stress_level_manual >= 1 AND stress_level_manual <= 5),
        motivation_level           INTEGER CHECK (motivation_level >= 1 AND motivation_level <= 5),
        focus_concentration_level  INTEGER CHECK (focus_concentration_level >= 1 AND focus_concentration_level <= 5),
        anxiety_level              INTEGER CHECK (anxiety_level >= 1 AND anxiety_level <= 5),
        irritability_level         INTEGER CHECK (irritability_level >= 1 AND irritability_level <= 5),
        happiness_level            INTEGER CHECK (happiness_level >= 1 AND happiness_level <= 5),
        productivity_level         INTEGER CHECK (productivity_level >= 1 AND productivity_level <= 5),
        creativity_level           INTEGER CHECK (creativity_level >= 1 AND creativity_level <= 5),
        pain_level                 INTEGER CHECK (pain_level >= 1 AND pain_level <= 5),
        pain_location              VARCHAR(200),
        sickness_type              VARCHAR(100),
        overall_day_score          INTEGER CHECK (overall_day_score >= 1 AND overall_day_score <= 5),
        major_event_flag           BOOLEAN DEFAULT FALSE,
        gratitude_note             TEXT,
        highlight_of_the_day       TEXT,

        -- Odżywianie i nawodnienie
        diet_type                  VARCHAR(100),
        meals_count                INTEGER CHECK (meals_count >= 0),
        fasting_hours              INTEGER CHECK (fasting_hours >= 0),
        caffeine_intake_mg         INTEGER CHECK (caffeine_intake_mg >= 0),
        water_intake_ml            INTEGER CHECK (water_intake_ml >= 0),
        last_meal_time             TIME,
        last_caffeine_time         TIME,
        diet_score                 INTEGER CHECK (diet_score >= 1 AND diet_score <= 5),
        calories_intake_kcal       INTEGER CHECK (calories_intake_kcal >= 0),
        protein_intake_g           INTEGER CHECK (protein_intake_g >= 0),
        fat_intake_g               INTEGER CHECK (fat_intake_g >= 0),
        carbs_intake_g             INTEGER CHECK (carbs_intake_g >= 0),

        -- Suplementy i używki
        supplement_vitamin_b       BOOLEAN DEFAULT FALSE,
        supplement_vitamin_c       BOOLEAN DEFAULT FALSE,
        supplement_vitamin_d3      BOOLEAN DEFAULT FALSE,
        supplement_omega3          BOOLEAN DEFAULT FALSE,
        supplement_ashwagandha     BOOLEAN DEFAULT FALSE,
        supplement_rhodiola        BOOLEAN DEFAULT FALSE,
        supplement_melatonin       BOOLEAN DEFAULT FALSE,
        supplement_magnesium_b6    BOOLEAN DEFAULT FALSE,
        supplement_caffeine        BOOLEAN DEFAULT FALSE,
        alcohol_type               VARCHAR(100),
        alcohol_units              FLOAT CHECK (alcohol_units >= 0),
        alcohol_time               TIME,
        nicotine_use               BOOLEAN DEFAULT FALSE,
        medication_taken           TEXT,
        recreational_drugs_taken   TEXT,

        -- Aktywność fizyczna i nawyki
        workout_type_manual        VARCHAR(200),
        sun_exposure_minutes       INTEGER CHECK (sun_exposure_minutes >= 0),
        time_outdoors_minutes      INTEGER CHECK (time_outdoors_minutes >= 0),
        social_contact_status      VARCHAR(50),
        social_quality_rating      INTEGER CHECK (social_quality_rating >= 1 AND social_quality_rating <= 5),
        nap                        BOOLEAN DEFAULT FALSE,
        meditated                  BOOLEAN DEFAULT FALSE,
        meditated_before_sleep     BOOLEAN DEFAULT FALSE,
        sweet_cravings             BOOLEAN DEFAULT FALSE,
        night_snacking             BOOLEAN DEFAULT FALSE,
        sauna                      BOOLEAN DEFAULT FALSE,
        used_sleep_mask            BOOLEAN DEFAULT FALSE,
        used_ear_plugs             BOOLEAN DEFAULT FALSE,
        read_before_sleep          BOOLEAN DEFAULT FALSE,
        hot_bath_before_sleep      BOOLEAN DEFAULT FALSE,

        -- Sen
        sleep_quality_manual       INTEGER CHECK (sleep_quality_manual >= 1 AND sleep_quality_manual <= 5),
        dream_intensity_rating     INTEGER CHECK (dream_intensity_rating >= 1 AND dream_intensity_rating <= 5),

        -- Czynniki środowiskowe i kontekst dnia
        weather_conditions         VARCHAR(100),
        travel_day                 BOOLEAN DEFAULT FALSE,
        morning_sunlight           BOOLEAN DEFAULT FALSE,

        -- Metadane
        tags                       VARCHAR(500),
        created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    with engine.connect() as conn:
        conn.execute(text(create_table_sql))
        conn.commit()
        logger.info("New daily_journal table created successfully")

def create_indexes(engine):
    """Create useful indexes"""
    logger.info("Creating indexes...")
    
    indexes = [
        "CREATE INDEX idx_daily_journal_day ON daily_journal(day);",
        "CREATE INDEX idx_daily_journal_mood ON daily_journal(mood);",
        "CREATE INDEX idx_daily_journal_energy ON daily_journal(energy_level);",
        "CREATE INDEX idx_daily_journal_created_at ON daily_journal(created_at);",
        "CREATE INDEX idx_daily_journal_tags ON daily_journal USING gin(to_tsvector('english', tags));"
    ]
    
    with engine.connect() as conn:
        for index_sql in indexes:
            try:
                conn.execute(text(index_sql))
                conn.commit()
            except Exception as e:
                logger.warning(f"Could not create index: {e}")

def create_update_trigger(engine):
    """Create trigger to automatically update updated_at timestamp"""
    logger.info("Creating update trigger...")
    
    trigger_sql = """
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_daily_journal_updated_at ON daily_journal;
    CREATE TRIGGER update_daily_journal_updated_at
        BEFORE UPDATE ON daily_journal
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    
    with engine.connect() as conn:
        conn.execute(text(trigger_sql))
        conn.commit()

def migrate_old_data(engine):
    """Migrate data from backup to new structure"""
    logger.info("Migrating old data to new structure...")
    
    # Check if backup table exists
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'daily_journal_backup'
            );
        """))
        
        if not result.scalar():
            logger.info("No backup table found, skipping data migration")
            return
        
        # Get columns from backup table
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_journal_backup'
        """))
        old_columns = [row[0] for row in result.fetchall()]
        
        # Map old columns to new columns
        column_mapping = {
            'day': 'day',
            'location': 'location',
            'mood': 'mood',  # Will need to convert from string to integer
            'alcohol': 'alcohol_type',
            'meditated': 'meditated',
            'calories_controlled': None,  # No direct mapping
            'sweet_cravings': 'sweet_cravings',
            'night_snacking': 'night_snacking',
            'notes': 'highlight_of_the_day',
            'supplement_ashwagandha': 'supplement_ashwagandha',
            'supplement_magnesium': 'supplement_magnesium_b6',
            'supplement_vitamin_d': 'supplement_vitamin_d3',
            'supplements_taken': 'medication_taken',
            'used_sleep_mask': 'used_sleep_mask',
            'used_ear_plugs': 'used_ear_plugs',
            'bedroom_temp_rating': None,  # No direct mapping
            'read_before_sleep': 'read_before_sleep',
            'used_phone_before_sleep': None,  # No direct mapping
            'hot_bath_before_sleep': 'hot_bath_before_sleep',
            'created_at': 'created_at',
            'updated_at': 'updated_at'
        }
        
        # Build migration query
        select_parts = []
        for old_col in old_columns:
            new_col = column_mapping.get(old_col)
            if new_col:
                if old_col == 'mood':
                    # Convert mood from string to integer
                    select_parts.append(f"""
                        CASE 
                            WHEN mood = 'terrible' THEN 1
                            WHEN mood = 'bad' THEN 2
                            WHEN mood = 'okay' THEN 3
                            WHEN mood = 'good' THEN 4
                            WHEN mood = 'great' THEN 5
                            ELSE NULL
                        END as {new_col}
                    """)
                else:
                    select_parts.append(f"{old_col} as {new_col}")
        
        if select_parts:
            migration_sql = f"""
                INSERT INTO daily_journal ({', '.join([part.split(' as ')[-1] for part in select_parts])})
                SELECT {', '.join(select_parts)}
                FROM daily_journal_backup
                ON CONFLICT (day) DO NOTHING;
            """
            
            conn.execute(text(migration_sql))
            conn.commit()
            
            # Count migrated records
            result = conn.execute(text("SELECT COUNT(*) FROM daily_journal"))
            count = result.scalar()
            logger.info(f"Migrated {count} records to new structure")

def create_sample_entries(engine):
    """Create sample entries to show the new structure"""
    logger.info("Creating sample entries...")
    
    sample_sql = """
    INSERT INTO daily_journal (
        day, mood, energy_level, stress_level_manual, 
        supplement_vitamin_d3, supplement_ashwagandha,
        meditated, sleep_quality_manual, highlight_of_the_day
    ) VALUES 
    (CURRENT_DATE, 4, 4, 2, true, true, true, 4, 'Updated journal structure - ready for comprehensive tracking!'),
    (CURRENT_DATE - INTERVAL '1 day', 3, 3, 3, false, true, false, 3, 'Previous day sample entry')
    ON CONFLICT (day) DO NOTHING;
    """
    
    with engine.connect() as conn:
        conn.execute(text(sample_sql))
        conn.commit()

def main():
    """Main function to update daily_journal structure"""
    logger.info("Starting daily_journal structure update...")
    
    try:
        engine = get_db_connection()
        
        # Step 1: Backup existing data
        backup_existing_data(engine)
        
        # Step 2: Drop old table
        drop_old_table(engine)
        
        # Step 3: Create new table
        create_new_daily_journal_table(engine)
        
        # Step 4: Create indexes
        create_indexes(engine)
        
        # Step 5: Create update trigger
        create_update_trigger(engine)
        
        # Step 6: Migrate old data
        migrate_old_data(engine)
        
        # Step 7: Create sample entries
        create_sample_entries(engine)
        
        logger.info("Daily journal structure update completed successfully!")
        
        print("\n" + "="*60)
        print("🎉 DAILY JOURNAL STRUCTURE UPDATED!")
        print("="*60)
        print("✅ New comprehensive tracking fields added")
        print("✅ Data validation constraints applied")
        print("✅ Indexes created for performance")
        print("✅ Auto-update timestamps configured")
        print("✅ Sample entries created")
        print("\n📊 New tracking capabilities:")
        print("   • Mood & energy levels (1-5 scale)")
        print("   • Detailed supplement tracking")
        print("   • Nutrition & hydration metrics")
        print("   • Sleep environment factors")
        print("   • Social & environmental context")
        print("   • Pain & health indicators")
        print("="*60)
        
    except Exception as e:
        logger.error(f"Error updating daily_journal structure: {e}")
        raise

if __name__ == "__main__":
    main()