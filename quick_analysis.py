#!/usr/bin/env python3
"""
Quick analysis script for Garmin health data
Provides instant insights into your health patterns
"""

from data_manager import GarminDataManager
from datetime import date, timedelta
import pandas as pd

def print_header(title):
    """Print formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_section(title):
    """Print formatted section"""
    print(f"\n📊 {title}")
    print("-" * 40)

def analyze_supplement_effectiveness():
    """Analyze supplement effectiveness"""
    manager = GarminDataManager()
    session = manager.get_session()
    
    try:
        from enhanced_migration import DailyJournal, GarminSleepSession
        
        # Query for supplement and sleep data
        query = session.query(
            DailyJournal.supplement_ashwagandha,
            DailyJournal.supplement_magnesium,
            DailyJournal.supplement_vitamin_d,
            DailyJournal.mood,
            GarminSleepSession.sleep_score,
            GarminSleepSession.sleep_duration_seconds
        ).outerjoin(
            GarminSleepSession, DailyJournal.day == GarminSleepSession.day
        ).filter(
            DailyJournal.day >= date.today() - timedelta(days=90)
        )
        
        df = pd.read_sql(query.statement, session.bind)
        
        if df.empty:
            print("No supplement data found")
            return
        
        print_section("Supplement Effectiveness Analysis")
        
        # Analyze each supplement
        supplements = ['supplement_ashwagandha', 'supplement_magnesium', 'supplement_vitamin_d']
        supplement_names = ['Ashwagandha', 'Magnesium', 'Vitamin D']
        
        for supp, name in zip(supplements, supplement_names):
            if supp in df.columns:
                took_supp = df[df[supp] == True]
                no_supp = df[df[supp] == False]
                
                if len(took_supp) > 0 and len(no_supp) > 0:
                    avg_sleep_with = took_supp['sleep_score'].mean()
                    avg_sleep_without = no_supp['sleep_score'].mean()
                    
                    avg_duration_with = took_supp['sleep_duration_seconds'].mean() / 3600
                    avg_duration_without = no_supp['sleep_duration_seconds'].mean() / 3600
                    
                    print(f"\n{name}:")
                    print(f"  Days taken: {len(took_supp)}")
                    print(f"  Sleep score with: {avg_sleep_with:.1f}")
                    print(f"  Sleep score without: {avg_sleep_without:.1f}")
                    print(f"  Sleep duration with: {avg_duration_with:.1f}h")
                    print(f"  Sleep duration without: {avg_duration_without:.1f}h")
                    
                    if avg_sleep_with > avg_sleep_without:
                        print(f"  ✅ Positive effect on sleep score (+{avg_sleep_with - avg_sleep_without:.1f})")
                    else:
                        print(f"  ❌ Negative effect on sleep score ({avg_sleep_with - avg_sleep_without:.1f})")
        
    finally:
        session.close()

def analyze_meditation_impact():
    """Analyze meditation impact on health metrics"""
    manager = GarminDataManager()
    session = manager.get_session()
    
    try:
        from enhanced_migration import DailyJournal, GarminSleepSession, GarminDailySummary
        
        query = session.query(
            DailyJournal.meditated,
            DailyJournal.mood,
            GarminSleepSession.sleep_score,
            GarminDailySummary.resting_heart_rate,
            GarminDailySummary.steps
        ).outerjoin(
            GarminSleepSession, DailyJournal.day == GarminSleepSession.day
        ).outerjoin(
            GarminDailySummary, DailyJournal.day == GarminDailySummary.day
        ).filter(
            DailyJournal.day >= date.today() - timedelta(days=90)
        )
        
        df = pd.read_sql(query.statement, session.bind)
        
        if df.empty:
            print("No meditation data found")
            return
        
        print_section("Meditation Impact Analysis")
        
        meditated = df[df['meditated'] == True]
        no_meditation = df[df['meditated'] == False]
        
        if len(meditated) > 0 and len(no_meditation) > 0:
            print(f"Days with meditation: {len(meditated)}")
            print(f"Days without meditation: {len(no_meditation)}")
            
            # Sleep impact
            sleep_with = meditated['sleep_score'].mean()
            sleep_without = no_meditation['sleep_score'].mean()
            print(f"\nSleep Score:")
            print(f"  With meditation: {sleep_with:.1f}")
            print(f"  Without meditation: {sleep_without:.1f}")
            print(f"  Difference: {sleep_with - sleep_without:+.1f}")
            
            # RHR impact
            rhr_with = meditated['resting_heart_rate'].mean()
            rhr_without = no_meditation['resting_heart_rate'].mean()
            print(f"\nResting Heart Rate:")
            print(f"  With meditation: {rhr_with:.1f} bpm")
            print(f"  Without meditation: {rhr_without:.1f} bpm")
            print(f"  Difference: {rhr_with - rhr_without:+.1f} bpm")
            
            # Activity impact
            steps_with = meditated['steps'].mean()
            steps_without = no_meditation['steps'].mean()
            print(f"\nDaily Steps:")
            print(f"  With meditation: {steps_with:.0f}")
            print(f"  Without meditation: {steps_without:.0f}")
            print(f"  Difference: {steps_with - steps_without:+.0f}")
        
    finally:
        session.close()

def analyze_sleep_environment():
    """Analyze sleep environment factors"""
    manager = GarminDataManager()
    session = manager.get_session()
    
    try:
        from enhanced_migration import DailyJournal, GarminSleepSession
        
        query = session.query(
            DailyJournal.used_sleep_mask,
            DailyJournal.used_ear_plugs,
            DailyJournal.bedroom_temp_rating,
            DailyJournal.read_before_sleep,
            DailyJournal.used_phone_before_sleep,
            DailyJournal.hot_bath_before_sleep,
            GarminSleepSession.sleep_score,
            GarminSleepSession.sleep_duration_seconds
        ).outerjoin(
            GarminSleepSession, DailyJournal.day == GarminSleepSession.day
        ).filter(
            DailyJournal.day >= date.today() - timedelta(days=90)
        )
        
        df = pd.read_sql(query.statement, session.bind)
        
        if df.empty:
            print("No sleep environment data found")
            return
        
        print_section("Sleep Environment Analysis")
        
        # Analyze boolean factors
        boolean_factors = [
            ('used_sleep_mask', 'Sleep Mask'),
            ('used_ear_plugs', 'Ear Plugs'),
            ('read_before_sleep', 'Reading Before Sleep'),
            ('hot_bath_before_sleep', 'Hot Bath Before Sleep')
        ]
        
        for factor, name in boolean_factors:
            if factor in df.columns:
                with_factor = df[df[factor] == True]
                without_factor = df[df[factor] == False]
                
                if len(with_factor) > 0 and len(without_factor) > 0:
                    sleep_with = with_factor['sleep_score'].mean()
                    sleep_without = without_factor['sleep_score'].mean()
                    
                    print(f"\n{name}:")
                    print(f"  With: {sleep_with:.1f} sleep score ({len(with_factor)} days)")
                    print(f"  Without: {sleep_without:.1f} sleep score ({len(without_factor)} days)")
                    print(f"  Difference: {sleep_with - sleep_without:+.1f}")
        
        # Analyze phone usage (negative factor)
        if 'used_phone_before_sleep' in df.columns:
            with_phone = df[df['used_phone_before_sleep'] == True]
            without_phone = df[df['used_phone_before_sleep'] == False]
            
            if len(with_phone) > 0 and len(without_phone) > 0:
                sleep_with = with_phone['sleep_score'].mean()
                sleep_without = without_phone['sleep_score'].mean()
                
                print(f"\nPhone Before Sleep:")
                print(f"  With phone: {sleep_with:.1f} sleep score ({len(with_phone)} days)")
                print(f"  Without phone: {sleep_without:.1f} sleep score ({len(without_phone)} days)")
                print(f"  Difference: {sleep_with - sleep_without:+.1f}")
                
                if sleep_without > sleep_with:
                    print(f"  ✅ Avoiding phone improves sleep by {sleep_without - sleep_with:.1f} points")
                else:
                    print(f"  ❌ Phone usage doesn't seem to affect sleep negatively")
        
    finally:
        session.close()

def main():
    """Main analysis function"""
    print_header("🏃‍♂️ Garmin Health Data Quick Analysis")
    
    manager = GarminDataManager()
    
    # Basic statistics
    print_section("Basic Statistics")
    
    # Sleep analysis
    sleep_analysis = manager.get_sleep_analysis(30)
    if sleep_analysis:
        print(f"Average sleep duration: {sleep_analysis['avg_duration_hours']:.1f} hours")
        print(f"Average sleep score: {sleep_analysis['avg_sleep_score']:.1f}")
        print(f"Best sleep score: {sleep_analysis['best_sleep_score']}")
        print(f"Worst sleep score: {sleep_analysis['worst_sleep_score']}")
    
    # Weight trend
    weight_trend = manager.get_weight_trend(90)
    if weight_trend:
        print(f"\nWeight change (90 days): {weight_trend['weight_change']:+.1f} kg")
        print(f"Current weight: {weight_trend['last_weight']:.1f} kg")
        print(f"Weight range: {weight_trend['min_weight']:.1f} - {weight_trend['max_weight']:.1f} kg")
    
    # Detailed analyses
    analyze_supplement_effectiveness()
    analyze_meditation_impact()
    analyze_sleep_environment()
    
    print_header("🎯 Recommendations")
    print("Based on your data analysis:")
    print("1. Check which supplements show positive correlation with sleep")
    print("2. Consider meditation if it improves your metrics")
    print("3. Optimize your sleep environment based on the analysis")
    print("4. Track patterns over time to identify what works best for you")

if __name__ == "__main__":
    main()