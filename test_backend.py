#!/usr/bin/env python3
"""
Test script for backend API
"""

import requests
import json
from datetime import date, timedelta

def test_api():
    """Test API endpoints"""
    base_url = "http://localhost:5000/api"
    
    print("🧪 Testing Backend API")
    print("=" * 40)
    
    # Test endpoints
    endpoints = [
        ("/stats", "Basic Statistics"),
        ("/sleep-trend?days=7", "Sleep Trend (7 days)"),
        ("/weight-trend?days=30", "Weight Trend (30 days)"),
        ("/mood-distribution?days=30", "Mood Distribution"),
        ("/analytics/supplements", "Supplement Analysis"),
        ("/analytics/meditation", "Meditation Analysis"),
    ]
    
    for endpoint, description in endpoints:
        try:
            print(f"\n📊 Testing: {description}")
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success - Got {len(data) if isinstance(data, list) else 'data'} items")
                
                # Show sample data
                if isinstance(data, list) and data:
                    print(f"   Sample: {data[0]}")
                elif isinstance(data, dict):
                    print(f"   Keys: {list(data.keys())}")
            else:
                print(f"❌ Failed - Status: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection failed - Is backend running?")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Test journal update
    print(f"\n📝 Testing: Journal Update")
    try:
        today = date.today().isoformat()
        test_data = {
            "mood": "good",
            "meditated": True,
            "supplement_ashwagandha": True,
            "notes": "Test entry from API test"
        }
        
        response = requests.put(
            f"{base_url}/journal/{today}", 
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 200:
            print("✅ Journal update successful")
        else:
            print(f"❌ Journal update failed - Status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Journal test error: {e}")
    
    print("\n🎯 Test completed!")
    print("If all tests passed, your backend is working correctly!")

if __name__ == "__main__":
    test_api()