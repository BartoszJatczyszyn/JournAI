#!/usr/bin/env python3
"""
Test script for the fixed migration in AI directory
"""

import os
import sys
from pathlib import Path

def test_environment():
    """Test if environment is ready"""
    print("🔍 Testing Environment...")
    
    # Check required packages
    try:
        import psycopg2
        print("✅ psycopg2 available")
    except ImportError:
        print("❌ psycopg2 not installed")
        return False
    
    try:
        import sqlalchemy
        print("✅ sqlalchemy available")
    except ImportError:
        print("❌ sqlalchemy not installed")
        return False
    
    try:
        from dotenv import load_dotenv
        print("✅ python-dotenv available")
    except ImportError:
        print("❌ python-dotenv not installed")
        return False
    
    # Check config
    if Path("config.env").exists():
        print("✅ config.env found")
    else:
        print("❌ config.env not found")
        return False
    
    # Check HealthData
    load_dotenv('config.env')
    health_data_path = os.getenv('HEALTH_DATA_PATH', 'C:/Users/barto/HealthData')
    
    if Path(health_data_path).exists():
        print(f"✅ HealthData found at: {health_data_path}")
        
        # Check subdirectories
        subdirs = ["Sleep", "RHR", "Weight"]
        for subdir in subdirs:
            subdir_path = Path(health_data_path) / subdir
            if subdir_path.exists():
                file_count = len(list(subdir_path.glob("*.json")))
                print(f"✅ {subdir}: {file_count} JSON files")
            else:
                print(f"⚠️  {subdir} directory not found")
    else:
        print(f"❌ HealthData not found at: {health_data_path}")
        return False
    
    return True

def test_database_connection():
    """Test database connection"""
    print("\n🔗 Testing Database Connection...")
    
    try:
        from dotenv import load_dotenv
        import psycopg2
        
        load_dotenv('config.env')
        
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            port=int(os.getenv('DB_PORT')),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ Connected to PostgreSQL: {version[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def run_migration():
    """Run the enhanced migration"""
    print("\n🚀 Running Enhanced Migration...")
    
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        migrator = EnhancedGarminMigrator()
        migrator.run_migration()
        
        print("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Specific error handling
        error_str = str(e).lower()
        if "integer out of range" in error_str:
            print("\n💡 Integer out of range error:")
            print("- This should be fixed with BigInteger types")
            print("- Check if there are still some INTEGER fields that need BigInteger")
        elif "connection" in error_str:
            print("\n💡 Connection error:")
            print("- Check if PostgreSQL is running")
            print("- Verify database credentials in config.env")
        elif "permission" in error_str:
            print("\n💡 Permission error:")
            print("- Check database user permissions")
            print("- Ensure user can CREATE tables")
        elif "does not exist" in error_str:
            print("\n💡 Database/table error:")
            print("- Make sure database exists: CREATE DATABASE diary;")
            print("- Check database name in config.env")
        
        return False

def check_migration_results():
    """Check migration results"""
    print("\n📊 Checking Migration Results...")
    
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        migrator = EnhancedGarminMigrator()
        session = migrator.SessionLocal()
        
        try:
            from enhanced_migration import GarminDailySummary, GarminSleepSession, GarminWeight, DailyJournal
            
            # Count records
            summary_count = session.query(GarminDailySummary).count()
            sleep_count = session.query(GarminSleepSession).count()
            weight_count = session.query(GarminWeight).count()
            journal_count = session.query(DailyJournal).count()
            
            print(f"📈 Migration Results:")
            print(f"  Daily Summaries: {summary_count}")
            print(f"  Sleep Sessions: {sleep_count}")
            print(f"  Weight Records: {weight_count}")
            print(f"  Journal Entries: {journal_count}")
            
            if summary_count > 0 or sleep_count > 0 or weight_count > 0:
                print("✅ Data successfully migrated!")
                
                # Show sample data
                if sleep_count > 0:
                    latest_sleep = session.query(GarminSleepSession).order_by(GarminSleepSession.day.desc()).first()
                    if latest_sleep:
                        print(f"\n📝 Latest Sleep Record:")
                        print(f"  Date: {latest_sleep.day}")
                        print(f"  Duration: {latest_sleep.sleep_duration_seconds/3600:.1f}h" if latest_sleep.sleep_duration_seconds else "N/A")
                        print(f"  Score: {latest_sleep.sleep_score}" if latest_sleep.sleep_score else "N/A")
                
                return True
            else:
                print("⚠️  No data was migrated")
                return False
                
        finally:
            session.close()
            
    except Exception as e:
        print(f"❌ Error checking results: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing Fixed Garmin Migration")
    print("=" * 50)
    
    success = True
    
    # Test environment
    if not test_environment():
        print("\n❌ Environment test failed")
        success = False
    
    # Test database connection
    if success and not test_database_connection():
        print("\n❌ Database connection test failed")
        success = False
    
    # Run migration
    if success and not run_migration():
        print("\n❌ Migration test failed")
        success = False
    
    # Check results
    if success and not check_migration_results():
        print("\n❌ Results check failed")
        success = False
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 All tests passed! Migration successful!")
        print("\nNext steps:")
        print("1. Use data_manager.py to analyze your data")
        print("2. Update journal entries with daily notes")
        print("3. Run quick_analysis.py for insights")
    else:
        print("❌ Some tests failed. Check errors above.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)