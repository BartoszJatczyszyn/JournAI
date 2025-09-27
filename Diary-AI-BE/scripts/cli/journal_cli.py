#!/usr/bin/env python3
"""
Command Line Interface for Daily Journal Management
Allows easy updating of journal entries from command line
"""

import argparse
from datetime import date, datetime, timedelta

from data_manager import GarminDataManager


def parse_date(date_string):
    """Parse date string in various formats"""
    if date_string.lower() == 'today':
        return date.today()
    elif date_string.lower() == 'yesterday':
        return date.today() - timedelta(days=1)
    else:
        try:
            return datetime.strptime(date_string, '%Y-%m-%d').date()
        except ValueError:
            raise argparse.ArgumentTypeError(
                f"Invalid date format: {date_string}. Use YYYY-MM-DD, 'today', or 'yesterday'"
            ) from None

def parse_bool(value):
    """Parse boolean value from string"""
    if value.lower() in ['true', 't', 'yes', 'y', '1']:
        return True
    elif value.lower() in ['false', 'f', 'no', 'n', '0']:
        return False
    else:
        raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")

def main():
    parser = argparse.ArgumentParser(description='Update daily journal entries')
    parser.add_argument('--date', type=parse_date, default=date.today(),
                       help='Date for journal entry (YYYY-MM-DD, today, yesterday)')
    
    # Basic fields
    parser.add_argument('--location', type=str, help='Location for the day')
    parser.add_argument('--mood', type=str, choices=['terrible', 'bad', 'okay', 'good', 'great'],
                       help='Mood rating')
    parser.add_argument('--alcohol', type=str, help='Alcohol consumption')
    parser.add_argument('--notes', type=str, help='Additional notes')
    
    # Boolean fields
    parser.add_argument('--meditated', type=parse_bool, help='Did you meditate? (true/false)')
    parser.add_argument('--calories-controlled', type=parse_bool, help='Controlled calories? (true/false)')
    parser.add_argument('--sweet-cravings', type=parse_bool, help='Had sweet cravings? (true/false)')
    parser.add_argument('--night-snacking', type=parse_bool, help='Night snacking? (true/false)')
    
    # Supplements
    parser.add_argument('--ashwagandha', type=parse_bool, help='Took ashwagandha? (true/false)')
    parser.add_argument('--magnesium', type=parse_bool, help='Took magnesium? (true/false)')
    parser.add_argument('--vitamin-d', type=parse_bool, help='Took vitamin D? (true/false)')
    parser.add_argument('--supplements', type=str, help='Other supplements taken')
    
    # Sleep environment
    parser.add_argument('--sleep-mask', type=parse_bool, help='Used sleep mask? (true/false)')
    parser.add_argument('--ear-plugs', type=parse_bool, help='Used ear plugs? (true/false)')
    parser.add_argument('--bedroom-temp', type=str, choices=['cold', 'cool', 'comfortable', 'warm', 'hot'],
                       help='Bedroom temperature rating')
    parser.add_argument('--read-before-sleep', type=parse_bool, help='Read before sleep? (true/false)')
    parser.add_argument('--phone-before-sleep', type=parse_bool, help='Used phone before sleep? (true/false)')
    parser.add_argument('--hot-bath', type=parse_bool, help='Hot bath before sleep? (true/false)')
    
    # Actions
    parser.add_argument('--show', action='store_true', help='Show current journal entry')
    parser.add_argument('--list', type=int, metavar='DAYS', help='List recent journal entries')
    
    args = parser.parse_args()
    
    manager = GarminDataManager()
    
    # Handle list action
    if args.list:
        entries = manager.get_recent_journal_entries(args.list)
        print(f"\n📝 Recent Journal Entries ({len(entries)} entries):")
        print("-" * 80)
        for entry in entries:
            supplements = []
            if entry.supplement_ashwagandha:
                supplements.append("Ashwagandha")
            if entry.supplement_magnesium:
                supplements.append("Magnesium")
            if entry.supplement_vitamin_d:
                supplements.append("Vitamin D")
            
            print(f"{entry.day} | Mood: {entry.mood or 'N/A':8} | Meditated: {entry.meditated or False}")
            if supplements:
                print(f"         | Supplements: {', '.join(supplements)}")
            if entry.notes:
                print(f"         | Notes: {entry.notes}")
            print()
        return
    
    # Handle show action
    if args.show:
        session = manager.get_session()
        try:
            from enhanced_migration import DailyJournal
            entry = session.query(DailyJournal).filter(DailyJournal.day == args.date).first()
            if entry:
                print(f"\n📝 Journal Entry for {args.date}:")
                print("-" * 40)
                print(f"Location: {entry.location or 'N/A'}")
                print(f"Mood: {entry.mood or 'N/A'}")
                print(f"Alcohol: {entry.alcohol or 'N/A'}")
                print(f"Meditated: {entry.meditated}")
                print(f"Calories controlled: {entry.calories_controlled}")
                print(f"Sweet cravings: {entry.sweet_cravings}")
                print(f"Night snacking: {entry.night_snacking}")
                print(f"Ashwagandha: {entry.supplement_ashwagandha}")
                print(f"Magnesium: {entry.supplement_magnesium}")
                print(f"Vitamin D: {entry.supplement_vitamin_d}")
                print(f"Other supplements: {entry.supplements_taken or 'N/A'}")
                print(f"Sleep mask: {entry.used_sleep_mask}")
                print(f"Ear plugs: {entry.used_ear_plugs}")
                print(f"Bedroom temp: {entry.bedroom_temp_rating or 'N/A'}")
                print(f"Read before sleep: {entry.read_before_sleep}")
                print(f"Phone before sleep: {entry.used_phone_before_sleep}")
                print(f"Hot bath: {entry.hot_bath_before_sleep}")
                print(f"Notes: {entry.notes or 'N/A'}")
            else:
                print(f"No journal entry found for {args.date}")
        finally:
            session.close()
        return
    
    # Prepare update data
    update_data = {}
    
    # Map command line arguments to database fields
    field_mapping = {
        'location': args.location,
        'mood': args.mood,
        'alcohol': args.alcohol,
        'notes': args.notes,
        'meditated': args.meditated,
        'calories_controlled': getattr(args, 'calories_controlled', None),
        'sweet_cravings': getattr(args, 'sweet_cravings', None),
        'night_snacking': getattr(args, 'night_snacking', None),
        'supplement_ashwagandha': args.ashwagandha,
        'supplement_magnesium': args.magnesium,
        'supplement_vitamin_d': getattr(args, 'vitamin_d', None),
        'supplements_taken': args.supplements,
        'used_sleep_mask': getattr(args, 'sleep_mask', None),
        'used_ear_plugs': getattr(args, 'ear_plugs', None),
        'bedroom_temp_rating': getattr(args, 'bedroom_temp', None),
        'read_before_sleep': getattr(args, 'read_before_sleep', None),
        'used_phone_before_sleep': getattr(args, 'phone_before_sleep', None),
        'hot_bath_before_sleep': getattr(args, 'hot_bath', None)
    }
    
    # Only include non-None values
    for field, value in field_mapping.items():
        if value is not None:
            update_data[field] = value
    
    if not update_data:
        print("No fields to update. Use --help for available options.")
        return
    
    # Update journal entry
    success = manager.update_journal_entry(args.date, **update_data)
    
    if success:
        print(f"✅ Journal entry for {args.date} updated successfully!")
        updated_fields = list(update_data.keys())
        print(f"Updated fields: {', '.join(updated_fields)}")
    else:
        print(f"❌ Failed to update journal entry for {args.date}")

if __name__ == "__main__":
    main()