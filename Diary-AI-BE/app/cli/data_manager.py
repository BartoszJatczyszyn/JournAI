#!/usr/bin/env python3
from datetime import date, datetime, timedelta
import os
from typing import Any

from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import and_, create_engine, or_
from sqlalchemy.orm import sessionmaker

from app.migrations.enhanced_migration import (
    DailyJournal,
    GarminDailySummary,
    GarminSleepSession,
    GarminWeight,
)

load_dotenv('config.env')

class GarminDataManager:
    def __init__(self):
        self.setup_database()
    
    def setup_database(self):
        """Setup database connection"""
        db_url = os.getenv('DATABASE_URL') or f"postgresql+psycopg://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
        self.engine = create_engine(db_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    def get_session(self):
        """Get database session"""
        return self.SessionLocal()
    
    def get_date_range_data(self, start_date: date, end_date: date) -> pd.DataFrame:
        """Get comprehensive data for a date range"""
        session = self.get_session()
        
        try:
            # Query all data for the date range
            query = session.query(
                GarminDailySummary.day,
                GarminDailySummary.steps,
                GarminDailySummary.resting_heart_rate,
                GarminDailySummary.calories_burned,
                GarminSleepSession.sleep_duration_seconds,
                GarminSleepSession.sleep_score,
                GarminWeight.weight_kg,
                DailyJournal.mood,
                DailyJournal.meditated,
                DailyJournal.alcohol,
                DailyJournal.supplement_ashwagandha,
                DailyJournal.supplement_magnesium,
                DailyJournal.supplement_vitamin_d
            ).outerjoin(
                GarminSleepSession, GarminDailySummary.day == GarminSleepSession.day
            ).outerjoin(
                GarminWeight, GarminDailySummary.day == GarminWeight.day
            ).outerjoin(
                DailyJournal, GarminDailySummary.day == DailyJournal.day
            ).filter(
                and_(
                    GarminDailySummary.day >= start_date,
                    GarminDailySummary.day <= end_date
                )
            ).order_by(GarminDailySummary.day)
            
            # Convert to DataFrame
            df = pd.read_sql(query.statement, session.bind)
            return df
            
        finally:
            session.close()
    
    def update_journal_entry(self, day: date, **kwargs) -> bool:
        """Update a journal entry for a specific day"""
        session = self.get_session()
        
        try:
            journal = session.query(DailyJournal).filter(DailyJournal.day == day).first()
            
            if not journal:
                # Create new journal entry if it doesn't exist
                journal = DailyJournal(day=day)
                session.add(journal)
            
            # Update fields
            for field, value in kwargs.items():
                if hasattr(journal, field):
                    setattr(journal, field, value)
            
            journal.updated_at = datetime.utcnow()
            session.commit()
            return True
            
        except Exception as e:
            session.rollback()
            print(f"Error updating journal entry: {e}")
            return False
        finally:
            session.close()
    
    def get_recent_journal_entries(self, days: int = 30) -> list[DailyJournal]:
        """Get recent journal entries"""
        session = self.get_session()
        
        try:
            start_date = date.today() - timedelta(days=days)
            entries = session.query(DailyJournal).filter(
                DailyJournal.day >= start_date
            ).order_by(DailyJournal.day.desc()).all()
            
            return entries
            
        finally:
            session.close()
    
    def get_sleep_analysis(self, days: int = 30) -> dict[str, Any]:
        """Get sleep analysis for recent days"""
        session = self.get_session()
        
        try:
            start_date = date.today() - timedelta(days=days)
            
            sleep_data = session.query(GarminSleepSession).filter(
                GarminSleepSession.day >= start_date
            ).all()
            
            if not sleep_data:
                return {}
            
            # Calculate statistics
            durations = [s.sleep_duration_seconds for s in sleep_data if s.sleep_duration_seconds]
            scores = [s.sleep_score for s in sleep_data if s.sleep_score]
            
            analysis = {
                'total_nights': len(sleep_data),
                'avg_duration_hours': sum(durations) / len(durations) / 3600 if durations else 0,
                'avg_sleep_score': sum(scores) / len(scores) if scores else 0,
                'best_sleep_score': max(scores) if scores else 0,
                'worst_sleep_score': min(scores) if scores else 0
            }
            
            return analysis
            
        finally:
            session.close()
    
    def get_weight_trend(self, days: int = 90) -> dict[str, Any]:
        """Get weight trend analysis"""
        session = self.get_session()
        
        try:
            start_date = date.today() - timedelta(days=days)
            
            weight_data = session.query(GarminWeight).filter(
                and_(
                    GarminWeight.day >= start_date,
                    GarminWeight.weight_kg.isnot(None)
                )
            ).order_by(GarminWeight.day).all()
            
            if len(weight_data) < 2:
                return {}
            
            weights = [w.weight_kg for w in weight_data]
            first_weight = weights[0]
            last_weight = weights[-1]
            
            analysis = {
                'total_measurements': len(weight_data),
                'first_weight': first_weight,
                'last_weight': last_weight,
                'weight_change': last_weight - first_weight,
                'avg_weight': sum(weights) / len(weights),
                'min_weight': min(weights),
                'max_weight': max(weights)
            }
            
            return analysis
            
        finally:
            session.close()
    
    def get_supplement_correlation(self) -> dict[str, Any]:
        """Analyze correlation between supplements and sleep/mood"""
        session = self.get_session()
        
        try:
            # Get data with supplements and sleep/mood info
            query = session.query(
                DailyJournal.supplement_ashwagandha,
                DailyJournal.supplement_magnesium,
                DailyJournal.supplement_vitamin_d,
                DailyJournal.mood,
                GarminSleepSession.sleep_score
            ).outerjoin(
                GarminSleepSession, DailyJournal.day == GarminSleepSession.day
            ).filter(
                or_(
                    DailyJournal.supplement_ashwagandha.is_(True),
                    DailyJournal.supplement_magnesium.is_(True),
                    DailyJournal.supplement_vitamin_d.is_(True)
                )
            )
            
            df = pd.read_sql(query.statement, session.bind)
            
            # Basic correlation analysis
            correlations = {}
            
            if not df.empty:
                # Convert mood to numeric (you might want to improve this mapping)
                mood_mapping = {'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1}
                df['mood_numeric'] = df['mood'].map(mood_mapping)
                
                # Calculate correlations
                for supplement in ['supplement_ashwagandha', 'supplement_magnesium', 'supplement_vitamin_d']:
                    if supplement in df.columns:
                        correlations[supplement] = {
                            'sleep_correlation': df[supplement].corr(df['sleep_score']) if 'sleep_score' in df.columns else None,
                            'mood_correlation': df[supplement].corr(df['mood_numeric']) if 'mood_numeric' in df.columns else None
                        }
            
            return correlations
            
        finally:
            session.close()

def main():
    """Example usage of the data manager"""
    manager = GarminDataManager()
    
    # Get recent data
    end_date = date.today()
    _start_date = end_date - timedelta(days=30)
    
    print("=== Garmin Health Data Analysis ===")
    
    # Sleep analysis
    sleep_analysis = manager.get_sleep_analysis(30)
    if sleep_analysis:
        print("\n📊 Sleep Analysis (Last 30 days):")
        print(f"  Average sleep: {sleep_analysis['avg_duration_hours']:.1f} hours")
        print(f"  Average sleep score: {sleep_analysis['avg_sleep_score']:.1f}")
        print(f"  Best sleep score: {sleep_analysis['best_sleep_score']}")
    
    # Weight trend
    weight_trend = manager.get_weight_trend(90)
    if weight_trend:
        print("\n⚖️ Weight Trend (Last 90 days):")
        print(f"  Weight change: {weight_trend['weight_change']:+.1f} kg")
        print(f"  Current weight: {weight_trend['last_weight']:.1f} kg")
        print(f"  Average weight: {weight_trend['avg_weight']:.1f} kg")
    
    # Recent journal entries
    recent_entries = manager.get_recent_journal_entries(7)
    print(f"\n📝 Recent Journal Entries ({len(recent_entries)} entries):")
    for entry in recent_entries[:5]:  # Show last 5
        supplements = []
        if entry.supplement_ashwagandha:
            supplements.append("Ashwagandha")
        if entry.supplement_magnesium:
            supplements.append("Magnesium")
        if entry.supplement_vitamin_d:
            supplements.append("Vitamin D")
        
        print(f"  {entry.day}: Mood: {entry.mood or 'N/A'}, Supplements: {', '.join(supplements) or 'None'}")

if __name__ == "__main__":
    main()