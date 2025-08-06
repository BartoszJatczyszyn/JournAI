#!/usr/bin/env python3
"""
Quick journal update for today
"""

from data_manager import GarminDataManager
from datetime import date

def quick_update():
    """Quick interactive journal update"""
    
    print("📝 Szybka Aktualizacja Dziennika")
    print("=" * 40)
    
    manager = GarminDataManager()
    today = date.today()
    
    print(f"Aktualizuję wpis na dzisiaj: {today}")
    
    # Simple questions
    mood = input("Jak się czujesz? (terrible/bad/okay/good/great): ").strip().lower()
    if mood not in ['terrible', 'bad', 'okay', 'good', 'great']:
        mood = None
    
    meditated = input("Medytowałeś dzisiaj? (tak/nie): ").strip().lower()
    meditated = True if meditated in ['tak', 't', 'yes', 'y'] else False if meditated in ['nie', 'n', 'no'] else None
    
    ashwagandha = input("Brałeś ashwagandha? (tak/nie): ").strip().lower()
    ashwagandha = True if ashwagandha in ['tak', 't', 'yes', 'y'] else False if ashwagandha in ['nie', 'n', 'no'] else None
    
    magnesium = input("Brałeś magnez? (tak/nie): ").strip().lower()
    magnesium = True if magnesium in ['tak', 't', 'yes', 'y'] else False if magnesium in ['nie', 'n', 'no'] else None
    
    vitamin_d = input("Brałeś witaminę D? (tak/nie): ").strip().lower()
    vitamin_d = True if vitamin_d in ['tak', 't', 'yes', 'y'] else False if vitamin_d in ['nie', 'n', 'no'] else None
    
    sleep_mask = input("Używałeś maski do spania? (tak/nie): ").strip().lower()
    sleep_mask = True if sleep_mask in ['tak', 't', 'yes', 'y'] else False if sleep_mask in ['nie', 'n', 'no'] else None
    
    notes = input("Dodatkowe notatki (opcjonalne): ").strip()
    if not notes:
        notes = None
    
    # Update journal
    update_data = {}
    if mood:
        update_data['mood'] = mood
    if meditated is not None:
        update_data['meditated'] = meditated
    if ashwagandha is not None:
        update_data['supplement_ashwagandha'] = ashwagandha
    if magnesium is not None:
        update_data['supplement_magnesium'] = magnesium
    if vitamin_d is not None:
        update_data['supplement_vitamin_d'] = vitamin_d
    if sleep_mask is not None:
        update_data['used_sleep_mask'] = sleep_mask
    if notes:
        update_data['notes'] = notes
    
    if update_data:
        success = manager.update_journal_entry(today, **update_data)
        
        if success:
            print(f"\n✅ Wpis na {today} został zaktualizowany!")
            print(f"Zaktualizowane pola: {', '.join(update_data.keys())}")
        else:
            print(f"\n❌ Błąd podczas aktualizacji wpisu")
    else:
        print("\n⚠️ Brak danych do aktualizacji")

if __name__ == "__main__":
    quick_update()