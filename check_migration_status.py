#!/usr/bin/env python3
"""
Check current migration status
"""

import os
from dotenv import load_dotenv

load_dotenv('config.env')

def check_status():
    """Check migration status"""
    
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        migrator = EnhancedGarminMigrator()
        session = migrator.SessionLocal()
        
        try:
            from enhanced_migration import GarminDailySummary, GarminSleepSession, GarminWeight, DailyJournal
            
            # Count all records
            summary_count = session.query(GarminDailySummary).count()
            sleep_count = session.query(GarminSleepSession).count()
            weight_count = session.query(GarminWeight).count()
            journal_count = session.query(DailyJournal).count()
            
            print("📊 Current Migration Status:")
            print("=" * 30)
            print(f"Daily Summaries: {summary_count}")
            print(f"Sleep Sessions: {sleep_count}")
            print(f"Weight Records: {weight_count}")
            print(f"Journal Entries: {journal_count}")
            
            if sleep_count > 0:
                print("\n✅ Sleep data migration successful!")
                
                # Show latest sleep record
                latest_sleep = session.query(GarminSleepSession).order_by(GarminSleepSession.day.desc()).first()
                if latest_sleep:
                    print(f"\n📝 Latest Sleep Record:")
                    print(f"  Date: {latest_sleep.day}")
                    print(f"  Sleep ID: {latest_sleep.sleep_id}")
                    print(f"  Duration: {latest_sleep.sleep_duration_seconds/3600:.1f}h" if latest_sleep.sleep_duration_seconds else "N/A")
                    print(f"  Score: {latest_sleep.sleep_score}" if latest_sleep.sleep_score else "N/A")
            else:
                print("\n❌ No sleep data found")
            
            # Check for recent data
            if summary_count > 0:
                latest_summary = session.query(GarminDailySummary).order_by(GarminDailySummary.day.desc()).first()
                if latest_summary:
                    print(f"\n📈 Latest Daily Summary:")
                    print(f"  Date: {latest_summary.day}")
                    print(f"  Steps: {latest_summary.steps or 'N/A'}")
                    print(f"  RHR: {latest_summary.resting_heart_rate or 'N/A'}")
            
            return True
            
        finally:
            session.close()
            
    except Exception as e:
        print(f"❌ Error checking status: {e}")
        return False

if __name__ == "__main__":
    check_status()