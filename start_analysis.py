#!/usr/bin/env python3
"""
Start analyzing your Garmin health data
"""

from data_manager import GarminDataManager
from datetime import date, timedelta

def main():
    """Show initial analysis of your health data"""
    
    print("🏃‍♂️ Analiza Twoich Danych Zdrowotnych")
    print("=" * 50)
    
    manager = GarminDataManager()
    
    # Basic statistics
    print("📊 Podstawowe Statystyki:")
    
    # Sleep analysis
    sleep_analysis = manager.get_sleep_analysis(30)
    if sleep_analysis:
        print(f"\n😴 Sen (ostatnie 30 dni):")
        print(f"  Średni czas snu: {sleep_analysis['avg_duration_hours']:.1f} godzin")
        print(f"  Średnia ocena snu: {sleep_analysis['avg_sleep_score']:.1f}")
        print(f"  Najlepsza ocena: {sleep_analysis['best_sleep_score']}")
        print(f"  Najgorsza ocena: {sleep_analysis['worst_sleep_score']}")
    
    # Weight trend
    weight_trend = manager.get_weight_trend(90)
    if weight_trend:
        print(f"\n⚖️ Waga (ostatnie 90 dni):")
        print(f"  Zmiana wagi: {weight_trend['weight_change']:+.1f} kg")
        print(f"  Aktualna waga: {weight_trend['last_weight']:.1f} kg")
        print(f"  Zakres wagi: {weight_trend['min_weight']:.1f} - {weight_trend['max_weight']:.1f} kg")
    
    # Recent journal entries
    recent_entries = manager.get_recent_journal_entries(7)
    print(f"\n📝 Ostatnie wpisy w dzienniku ({len(recent_entries)} wpisów):")
    for entry in recent_entries[:5]:
        supplements = []
        if entry.supplement_ashwagandha:
            supplements.append("Ashwagandha")
        if entry.supplement_magnesium:
            supplements.append("Magnez")
        if entry.supplement_vitamin_d:
            supplements.append("Witamina D")
        
        print(f"  {entry.day}: Nastrój: {entry.mood or 'Brak'}, Suplementy: {', '.join(supplements) or 'Brak'}")
    
    print(f"\n🎯 Co możesz teraz zrobić:")
    print("1. Aktualizuj dziennik: python journal_cli.py --date today --mood good --meditated true")
    print("2. Szczegółowa analiza: python quick_analysis.py")
    print("3. Dodaj wpis dziennika dla dzisiaj")
    print("4. Sprawdź korelacje między suplementami a snem")

if __name__ == "__main__":
    main()