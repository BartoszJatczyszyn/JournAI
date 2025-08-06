#!/usr/bin/env python3
"""
Fix sleep table structure - change sleep_id from INTEGER to BIGINT
"""

import os
from dotenv import load_dotenv
import psycopg2

load_dotenv('config.env')

def fix_sleep_table():
    """Fix the garmin_sleep_sessions table structure"""
    
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
        
        print("🔧 Fixing garmin_sleep_sessions table structure...")
        
        # Drop the existing table if it exists (since it's empty anyway)
        cursor.execute("DROP TABLE IF EXISTS garmin_sleep_sessions CASCADE;")
        print("✅ Dropped existing garmin_sleep_sessions table")
        
        # Create the table with correct BIGINT type
        cursor.execute("""
            CREATE TABLE garmin_sleep_sessions (
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
        print("✅ Created garmin_sleep_sessions table with BIGINT sleep_id")
        
        # Create index on day for better performance
        cursor.execute("CREATE INDEX idx_sleep_sessions_day ON garmin_sleep_sessions(day);")
        print("✅ Created index on day column")
        
        conn.commit()
        print("✅ Table structure fixed successfully!")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing table: {e}")
        return False

def test_sleep_migration():
    """Test migrating a few sleep records"""
    
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        print("\n🧪 Testing sleep migration with fixed table...")
        
        migrator = EnhancedGarminMigrator()
        
        # Try to migrate just sleep data
        migrator.migrate_sleep_data()
        
        # Check results
        session = migrator.SessionLocal()
        try:
            from enhanced_migration import GarminSleepSession
            
            sleep_count = session.query(GarminSleepSession).count()
            print(f"✅ Successfully migrated {sleep_count} sleep records!")
            
            if sleep_count > 0:
                # Show a sample record
                sample = session.query(GarminSleepSession).first()
                print(f"\n📝 Sample sleep record:")
                print(f"  Sleep ID: {sample.sleep_id}")
                print(f"  Date: {sample.day}")
                print(f"  Duration: {sample.sleep_duration_seconds/3600:.1f}h" if sample.sleep_duration_seconds else "N/A")
                print(f"  Score: {sample.sleep_score}" if sample.sleep_score else "N/A")
            
            return True
            
        finally:
            session.close()
            
    except Exception as e:
        print(f"❌ Sleep migration test failed: {e}")
        return False

def main():
    """Main function"""
    print("🔧 Fixing Sleep Table Structure")
    print("=" * 40)
    
    # Fix table structure
    if not fix_sleep_table():
        print("❌ Failed to fix table structure")
        return False
    
    # Test migration
    if not test_sleep_migration():
        print("❌ Sleep migration test failed")
        return False
    
    print("\n🎉 Sleep table fixed and migration successful!")
    print("\nNow you can run the full migration again:")
    print("python enhanced_migration.py")
    
    return True

if __name__ == "__main__":
    main()