#!/usr/bin/env python3
"""
Flask API Backend for Garmin Health Dashboard
Provides REST endpoints for the React frontend
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, date, timedelta
import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Load environment variables
load_dotenv('config.env')

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'diary'),
    'user': os.getenv('DB_USER', 'diary_user'),
    'password': os.getenv('DB_PASSWORD', 'diary123')
}

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def execute_query(query, params=None, fetch_one=False, fetch_all=True):
    """Execute database query safely"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            
            if fetch_one:
                return dict(cursor.fetchone()) if cursor.rowcount > 0 else None
            elif fetch_all:
                return [dict(row) for row in cursor.fetchall()]
            else:
                conn.commit()
                return True
    except Exception as e:
        print(f"Query error: {e}")
        return None
    finally:
        conn.close()

# API Routes

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get basic health statistics"""
    try:
        # Average sleep hours and score
        sleep_query = """
        SELECT 
            AVG(sleep_duration_seconds/3600.0) as avg_sleep_hours,
            AVG(sleep_score) as avg_sleep_score
        FROM garmin_sleep_sessions 
        WHERE sleep_duration_seconds IS NOT NULL 
        AND day >= CURRENT_DATE - INTERVAL '30 days'
        """
        
        # Average RHR
        rhr_query = """
        SELECT AVG(resting_heart_rate) as avg_rhr
        FROM garmin_daily_summaries 
        WHERE resting_heart_rate IS NOT NULL 
        AND day >= CURRENT_DATE - INTERVAL '30 days'
        """
        
        # Current weight
        weight_query = """
        SELECT weight_kg as current_weight
        FROM garmin_weight 
        WHERE weight_kg IS NOT NULL 
        ORDER BY day DESC 
        LIMIT 1
        """
        
        sleep_data = execute_query(sleep_query, fetch_one=True)
        rhr_data = execute_query(rhr_query, fetch_one=True)
        weight_data = execute_query(weight_query, fetch_one=True)
        
        stats = {
            'avgSleepHours': float(sleep_data['avg_sleep_hours']) if sleep_data and sleep_data['avg_sleep_hours'] else 0,
            'avgSleepScore': float(sleep_data['avg_sleep_score']) if sleep_data and sleep_data['avg_sleep_score'] else 0,
            'avgRHR': float(rhr_data['avg_rhr']) if rhr_data and rhr_data['avg_rhr'] else 0,
            'currentWeight': float(weight_data['current_weight']) if weight_data and weight_data['current_weight'] else 0
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sleep-trend', methods=['GET'])
def get_sleep_trend():
    """Get sleep trend data"""
    days = request.args.get('days', 30, type=int)
    
    query = """
    SELECT 
        day::text as date,
        sleep_duration_seconds/3600.0 as sleephours,
        sleep_score as sleepscore
    FROM garmin_sleep_sessions 
    WHERE day >= CURRENT_DATE - INTERVAL '%s days'
    AND sleep_duration_seconds IS NOT NULL
    ORDER BY day
    """
    
    data = execute_query(query, (days,))
    return jsonify(data or [])

@app.route('/api/weight-trend', methods=['GET'])
def get_weight_trend():
    """Get weight trend data"""
    days = request.args.get('days', 90, type=int)
    
    query = """
    SELECT 
        day::text as date,
        weight_kg as weight
    FROM garmin_weight 
    WHERE day >= CURRENT_DATE - INTERVAL '%s days'
    AND weight_kg IS NOT NULL
    ORDER BY day
    """
    
    data = execute_query(query, (days,))
    return jsonify(data or [])

@app.route('/api/mood-distribution', methods=['GET'])
def get_mood_distribution():
    """Get mood distribution data"""
    days = request.args.get('days', 30, type=int)
    
    query = """
    SELECT 
        mood as name,
        COUNT(*) as count
    FROM daily_journal 
    WHERE day >= CURRENT_DATE - INTERVAL '%s days'
    AND mood IS NOT NULL
    GROUP BY mood
    ORDER BY count DESC
    """
    
    data = execute_query(query, (days,))
    return jsonify(data or [])

@app.route('/api/journal/<date_str>', methods=['GET'])
def get_journal_entry(date_str):
    """Get journal entry for specific date"""
    try:
        query = """
        SELECT * FROM daily_journal 
        WHERE day = %s
        """
        
        data = execute_query(query, (date_str,), fetch_one=True)
        
        if not data:
            return jsonify({'error': 'Entry not found'}), 404
            
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/journal/<date_str>', methods=['PUT'])
def update_journal_entry(date_str):
    """Update journal entry for specific date"""
    try:
        data = request.json
        
        # Build dynamic update query
        fields = []
        values = []
        
        field_mapping = {
            'mood': 'mood',
            'location': 'location',
            'alcohol': 'alcohol',
            'notes': 'notes',
            'meditated': 'meditated',
            'calories_controlled': 'calories_controlled',
            'sweet_cravings': 'sweet_cravings',
            'night_snacking': 'night_snacking',
            'supplement_ashwagandha': 'supplement_ashwagandha',
            'supplement_magnesium': 'supplement_magnesium',
            'supplement_vitamin_d': 'supplement_vitamin_d',
            'supplements_taken': 'supplements_taken',
            'used_sleep_mask': 'used_sleep_mask',
            'used_ear_plugs': 'used_ear_plugs',
            'bedroom_temp_rating': 'bedroom_temp_rating',
            'read_before_sleep': 'read_before_sleep',
            'used_phone_before_sleep': 'used_phone_before_sleep',
            'hot_bath_before_sleep': 'hot_bath_before_sleep'
        }
        
        for key, db_field in field_mapping.items():
            if key in data:
                fields.append(f"{db_field} = %s")
                values.append(data[key])
        
        if not fields:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        values.append(date_str)
        
        # Try update first
        update_query = f"""
        UPDATE daily_journal 
        SET {', '.join(fields)}
        WHERE day = %s
        """
        
        result = execute_query(update_query, values, fetch_all=False)
        
        if result:
            return jsonify({'message': 'Journal entry updated successfully'})
        else:
            # If update failed, try insert
            all_fields = ['day'] + [field_mapping[key] for key in data.keys() if key in field_mapping]
            all_values = [date_str] + [data[key] for key in data.keys() if key in field_mapping]
            
            placeholders = ', '.join(['%s'] * len(all_values))
            insert_query = f"""
            INSERT INTO daily_journal ({', '.join(all_fields)})
            VALUES ({placeholders})
            """
            
            result = execute_query(insert_query, all_values, fetch_all=False)
            
            if result:
                return jsonify({'message': 'Journal entry created successfully'})
            else:
                return jsonify({'error': 'Failed to save journal entry'}), 500
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/supplements', methods=['GET'])
def get_supplement_analysis():
    """Get supplement effectiveness analysis"""
    query = """
    SELECT 
        j.supplement_ashwagandha,
        j.supplement_magnesium,
        j.supplement_vitamin_d,
        AVG(s.sleep_score) as avg_sleep_score,
        AVG(s.sleep_duration_seconds/3600.0) as avg_sleep_hours,
        COUNT(*) as days_count
    FROM daily_journal j
    JOIN garmin_sleep_sessions s ON j.day = s.day
    WHERE s.sleep_score IS NOT NULL
    GROUP BY j.supplement_ashwagandha, j.supplement_magnesium, j.supplement_vitamin_d
    HAVING COUNT(*) >= 3
    ORDER BY avg_sleep_score DESC
    """
    
    data = execute_query(query)
    return jsonify(data or [])

@app.route('/api/analytics/meditation', methods=['GET'])
def get_meditation_analysis():
    """Get meditation impact analysis"""
    query = """
    SELECT 
        j.meditated,
        AVG(s.sleep_score) as avg_sleep_score,
        AVG(s.sleep_duration_seconds/3600.0) as avg_sleep_hours,
        AVG(ds.resting_heart_rate) as avg_rhr,
        COUNT(*) as days_count
    FROM daily_journal j
    LEFT JOIN garmin_sleep_sessions s ON j.day = s.day
    LEFT JOIN garmin_daily_summaries ds ON j.day = ds.day
    WHERE j.meditated IS NOT NULL
    GROUP BY j.meditated
    """
    
    data = execute_query(query)
    
    # Format response
    result = {
        'daysWithMeditation': 0,
        'daysWithoutMeditation': 0,
        'meditationImpact': data or []
    }
    
    for row in data or []:
        if row['meditated']:
            result['daysWithMeditation'] = row['days_count']
        else:
            result['daysWithoutMeditation'] = row['days_count']
    
    return jsonify(result)

@app.route('/api/analytics/sleep-environment', methods=['GET'])
def get_sleep_environment_analysis():
    """Get sleep environment analysis"""
    factors = [
        ('used_sleep_mask', 'Maska do spania'),
        ('used_ear_plugs', 'Zatyczki do uszu'),
        ('read_before_sleep', 'Czytanie przed snem'),
        ('hot_bath_before_sleep', 'Gorąca kąpiel')
    ]
    
    results = []
    recommendations = []
    
    for factor_field, factor_name in factors:
        query = f"""
        SELECT 
            j.{factor_field},
            AVG(s.sleep_score) as avg_sleep_score
        FROM daily_journal j
        JOIN garmin_sleep_sessions s ON j.day = s.day
        WHERE j.{factor_field} IS NOT NULL AND s.sleep_score IS NOT NULL
        GROUP BY j.{factor_field}
        """
        
        data = execute_query(query)
        
        if data and len(data) == 2:
            with_factor = next((row for row in data if row[factor_field]), None)
            without_factor = next((row for row in data if not row[factor_field]), None)
            
            if with_factor and without_factor:
                score_with = float(with_factor['avg_sleep_score'])
                score_without = float(without_factor['avg_sleep_score'])
                
                results.append({
                    'factor': factor_name,
                    'sleepScoreWith': score_with,
                    'sleepScoreWithout': score_without
                })
                
                # Generate recommendation
                if score_with > score_without + 2:
                    recommendations.append({
                        'factor': factor_name,
                        'type': 'success',
                        'message': f'Pozytywny wpływ na sen (+{score_with - score_without:.1f} punktów)'
                    })
                elif score_without > score_with + 2:
                    recommendations.append({
                        'factor': factor_name,
                        'type': 'warning',
                        'message': f'Może negatywnie wpływać na sen (-{score_with - score_without:.1f} punktów)'
                    })
    
    return jsonify({
        'factors': results,
        'recommendations': recommendations
    })

@app.route('/api/analytics/correlations', methods=['GET'])
def get_correlation_analysis():
    """Get correlation analysis data"""
    # Mood vs Activity
    mood_activity_query = """
    SELECT 
        CASE 
            WHEN j.mood = 'terrible' THEN 1
            WHEN j.mood = 'bad' THEN 2
            WHEN j.mood = 'okay' THEN 3
            WHEN j.mood = 'good' THEN 4
            WHEN j.mood = 'great' THEN 5
            ELSE 3
        END as mood,
        ds.steps
    FROM daily_journal j
    JOIN garmin_daily_summaries ds ON j.day = ds.day
    WHERE j.mood IS NOT NULL AND ds.steps IS NOT NULL
    """
    
    # Sleep vs RHR
    sleep_rhr_query = """
    SELECT 
        s.sleep_score as sleepScore,
        ds.resting_heart_rate as rhr
    FROM garmin_sleep_sessions s
    JOIN garmin_daily_summaries ds ON s.day = ds.day
    WHERE s.sleep_score IS NOT NULL AND ds.resting_heart_rate IS NOT NULL
    """
    
    mood_activity_data = execute_query(mood_activity_query)
    sleep_rhr_data = execute_query(sleep_rhr_query)
    
    return jsonify({
        'moodVsActivity': mood_activity_data or [],
        'sleepVsRHR': sleep_rhr_data or []
    })

@app.route('/api/health-data', methods=['GET'])
def get_health_data():
    """Get comprehensive health data for table view"""
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    query = """
    SELECT 
        ds.day,
        j.mood,
        s.sleep_start,
        s.sleep_end,
        s.sleep_duration_seconds,
        s.sleep_score,
        s.deep_sleep_seconds,
        s.light_sleep_seconds,
        s.rem_sleep_seconds,
        s.awake_seconds,
        s.avg_sleep_stress,
        s.avg_spo2,
        ds.resting_heart_rate,
        ds.steps,
        ds.calories_burned,
        ds.active_calories,
        ds.hr_avg,
        ds.hr_max,
        ds.stress_avg,
        ds.spo2_avg,
        ds.body_battery_max,
        ds.body_battery_min,
        ds.distance_meters,
        w.weight_kg,
        j.meditated,
        j.supplement_ashwagandha,
        j.supplement_magnesium,
        j.supplement_vitamin_d,
        j.used_sleep_mask,
        j.notes
    FROM garmin_daily_summaries ds
    LEFT JOIN daily_journal j ON ds.day = j.day
    LEFT JOIN garmin_sleep_sessions s ON ds.day = s.day
    LEFT JOIN garmin_weight w ON ds.day = w.day
    WHERE ds.day >= %s AND ds.day <= %s
    ORDER BY ds.day DESC
    """
    
    data = execute_query(query, (start_date, end_date))
    return jsonify(data or [])

@app.route('/api/stress-data/<date_str>', methods=['GET'])
def get_stress_data(date_str):
    """Get minute-by-minute stress data for specific date"""
    try:
        query = """
        SELECT 
            timestamp,
            stress_level
        FROM garmin_stress_data 
        WHERE day = %s
        ORDER BY timestamp
        """
        
        data = execute_query(query, (date_str,))
        
        # Format for charts
        formatted_data = []
        for row in data or []:
            formatted_data.append({
                'time': row['timestamp'].strftime('%H:%M'),
                'timestamp': row['timestamp'].isoformat(),
                'stress': row['stress_level']
            })
        
        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stress-summary/<date_str>', methods=['GET'])
def get_stress_summary(date_str):
    """Get stress summary for specific date"""
    try:
        query = """
        SELECT 
            AVG(stress_level) as avg_stress,
            MIN(stress_level) as min_stress,
            MAX(stress_level) as max_stress,
            COUNT(*) as data_points,
            COUNT(CASE WHEN stress_level < 25 THEN 1 END) as low_stress_minutes,
            COUNT(CASE WHEN stress_level BETWEEN 25 AND 50 THEN 1 END) as medium_stress_minutes,
            COUNT(CASE WHEN stress_level BETWEEN 51 AND 75 THEN 1 END) as high_stress_minutes,
            COUNT(CASE WHEN stress_level > 75 THEN 1 END) as very_high_stress_minutes
        FROM garmin_stress_data 
        WHERE day = %s
        """
        
        data = execute_query(query, (date_str,), fetch_one=True)
        
        if not data:
            return jsonify({'error': 'No stress data found for this date'}), 404
        
        # Calculate percentages
        total_minutes = data['data_points']
        summary = {
            'avg_stress': round(float(data['avg_stress']), 1) if data['avg_stress'] else 0,
            'min_stress': data['min_stress'],
            'max_stress': data['max_stress'],
            'total_minutes': total_minutes,
            'stress_distribution': {
                'low': {
                    'minutes': data['low_stress_minutes'],
                    'percentage': round((data['low_stress_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'medium': {
                    'minutes': data['medium_stress_minutes'],
                    'percentage': round((data['medium_stress_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'high': {
                    'minutes': data['high_stress_minutes'],
                    'percentage': round((data['high_stress_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'very_high': {
                    'minutes': data['very_high_stress_minutes'],
                    'percentage': round((data['very_high_stress_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                }
            }
        }
        
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/heart-rate-data/<date_str>', methods=['GET'])
def get_heart_rate_data(date_str):
    """Get minute-by-minute heart rate data for specific date"""
    try:
        query = """
        SELECT 
            timestamp,
            heart_rate
        FROM garmin_heart_rate_data 
        WHERE day = %s
        ORDER BY timestamp
        """
        
        data = execute_query(query, (date_str,))
        
        # Format for charts
        formatted_data = []
        for row in data or []:
            formatted_data.append({
                'time': row['timestamp'].strftime('%H:%M'),
                'timestamp': row['timestamp'].isoformat(),
                'heart_rate': row['heart_rate']
            })
        
        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/heart-rate-summary/<date_str>', methods=['GET'])
def get_heart_rate_summary(date_str):
    """Get heart rate summary for specific date"""
    try:
        query = """
        SELECT 
            AVG(heart_rate) as avg_hr,
            MIN(heart_rate) as min_hr,
            MAX(heart_rate) as max_hr,
            COUNT(*) as data_points,
            COUNT(CASE WHEN heart_rate < 60 THEN 1 END) as resting_minutes,
            COUNT(CASE WHEN heart_rate BETWEEN 60 AND 100 THEN 1 END) as normal_minutes,
            COUNT(CASE WHEN heart_rate BETWEEN 101 AND 150 THEN 1 END) as elevated_minutes,
            COUNT(CASE WHEN heart_rate > 150 THEN 1 END) as high_minutes
        FROM garmin_heart_rate_data 
        WHERE day = %s
        """
        
        data = execute_query(query, (date_str,), fetch_one=True)
        
        if not data:
            return jsonify({'error': 'No heart rate data found for this date'}), 404
        
        # Calculate percentages
        total_minutes = data['data_points']
        summary = {
            'avg_hr': round(float(data['avg_hr']), 1) if data['avg_hr'] else 0,
            'min_hr': data['min_hr'],
            'max_hr': data['max_hr'],
            'total_minutes': total_minutes,
            'hr_distribution': {
                'resting': {
                    'minutes': data['resting_minutes'],
                    'percentage': round((data['resting_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'normal': {
                    'minutes': data['normal_minutes'],
                    'percentage': round((data['normal_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'elevated': {
                    'minutes': data['elevated_minutes'],
                    'percentage': round((data['elevated_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'high': {
                    'minutes': data['high_minutes'],
                    'percentage': round((data['high_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                }
            }
        }
        
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/respiratory-rate-data/<date_str>', methods=['GET'])
def get_respiratory_rate_data(date_str):
    """Get minute-by-minute respiratory rate data for specific date"""
    try:
        query = """
        SELECT 
            timestamp,
            respiratory_rate
        FROM garmin_respiratory_rate_data 
        WHERE day = %s
        ORDER BY timestamp
        """
        
        data = execute_query(query, (date_str,))
        
        # Format for charts
        formatted_data = []
        for row in data or []:
            formatted_data.append({
                'time': row['timestamp'].strftime('%H:%M'),
                'timestamp': row['timestamp'].isoformat(),
                'respiratory_rate': round(float(row['respiratory_rate']), 1)
            })
        
        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/respiratory-rate-summary/<date_str>', methods=['GET'])
def get_respiratory_rate_summary(date_str):
    """Get respiratory rate summary for specific date"""
    try:
        query = """
        SELECT 
            AVG(respiratory_rate) as avg_rr,
            MIN(respiratory_rate) as min_rr,
            MAX(respiratory_rate) as max_rr,
            COUNT(*) as data_points,
            COUNT(CASE WHEN respiratory_rate < 12 THEN 1 END) as low_rr_minutes,
            COUNT(CASE WHEN respiratory_rate BETWEEN 12 AND 20 THEN 1 END) as normal_rr_minutes,
            COUNT(CASE WHEN respiratory_rate BETWEEN 21 AND 25 THEN 1 END) as elevated_rr_minutes,
            COUNT(CASE WHEN respiratory_rate > 25 THEN 1 END) as high_rr_minutes
        FROM garmin_respiratory_rate_data 
        WHERE day = %s
        """
        
        data = execute_query(query, (date_str,), fetch_one=True)
        
        if not data:
            return jsonify({'error': 'No respiratory rate data found for this date'}), 404
        
        # Calculate percentages
        total_minutes = data['data_points']
        summary = {
            'avg_rr': round(float(data['avg_rr']), 1) if data['avg_rr'] else 0,
            'min_rr': round(float(data['min_rr']), 1) if data['min_rr'] else 0,
            'max_rr': round(float(data['max_rr']), 1) if data['max_rr'] else 0,
            'total_minutes': total_minutes,
            'rr_distribution': {
                'low': {
                    'minutes': data['low_rr_minutes'],
                    'percentage': round((data['low_rr_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'normal': {
                    'minutes': data['normal_rr_minutes'],
                    'percentage': round((data['normal_rr_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'elevated': {
                    'minutes': data['elevated_rr_minutes'],
                    'percentage': round((data['elevated_rr_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                },
                'high': {
                    'minutes': data['high_rr_minutes'],
                    'percentage': round((data['high_rr_minutes'] / total_minutes * 100), 1) if total_minutes > 0 else 0
                }
            }
        }
        
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    """Export health data"""
    format_type = request.args.get('format', 'csv')
    
    # For now, return JSON data
    # In production, you'd want to implement CSV/Excel export
    query = """
    SELECT 
        ds.day,
        j.mood,
        s.sleep_duration_seconds/3600.0 as sleep_hours,
        s.sleep_score,
        ds.resting_heart_rate,
        ds.steps,
        w.weight_kg,
        j.meditated,
        j.supplement_ashwagandha,
        j.supplement_magnesium,
        j.supplement_vitamin_d,
        j.used_sleep_mask,
        j.notes
    FROM garmin_daily_summaries ds
    LEFT JOIN daily_journal j ON ds.day = j.day
    LEFT JOIN garmin_sleep_sessions s ON ds.day = s.day
    LEFT JOIN garmin_weight w ON ds.day = w.day
    ORDER BY ds.day DESC
    """
    
    data = execute_query(query)
    return jsonify(data or [])

if __name__ == '__main__':
    print("🚀 Starting Garmin Health Dashboard API...")
    print(f"📊 Database: {DB_CONFIG['database']} on {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print("🌐 Frontend proxy configured for http://localhost:5000")
    print("📱 Access dashboard at: http://localhost:3000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)