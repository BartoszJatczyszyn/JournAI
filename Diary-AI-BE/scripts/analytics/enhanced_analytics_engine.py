#!/usr/bin/env python3
"""
Enhanced Analytics Engine for Garmin Health Data
Provides advanced correlations, machine learning insights, and predictive analytics
"""

import math
import os
from statistics import mean, stdev
import warnings

from dotenv import load_dotenv
from db import execute_query
from scipy import stats
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')

def correlation(x, y):
    """Calculate Pearson correlation coefficient"""
    if len(x) != len(y) or len(x) < 2:
        return 0
    
    n = len(x)
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(x[i] * y[i] for i in range(n))
    sum_x2 = sum(x[i] ** 2 for i in range(n))
    sum_y2 = sum(y[i] ** 2 for i in range(n))
    
    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2))
    
    if denominator == 0:
        return 0
    
    return numerator / denominator

# Load environment variables
load_dotenv('config.env')

class EnhancedHealthAnalytics:
    """Enhanced health data analytics with machine learning capabilities"""
    
    def __init__(self):
        # Store last fetch diagnostics
        self.last_fetch_meta = {}
    
    def get_recovery_trend(self, days: int = 90):
        """Compute daily recovery score series for the last N days.
        Returns list of dicts: [{day: 'YYYY-MM-DD', score: float}]
        """
        data = self.get_comprehensive_health_data(days)
        if not data:
            return []
        series = []
        for row in data:
            metrics = {}
            if row.get('rhr') is not None:
                try:
                    metrics['rhr'] = float(row['rhr'])
                except Exception:
                    pass
            if row.get('hr_variability') is not None:
                try:
                    metrics['hrv'] = float(row['hr_variability'])
                except Exception:
                    pass
            if row.get('sleep_score') is not None:
                try:
                    metrics['sleep_score'] = float(row['sleep_score'])
                except Exception:
                    pass
            if row.get('energy_level') is not None:
                try:
                    metrics['energy'] = float(row['energy_level'])
                except Exception:
                    pass
            if row.get('stress_avg') is not None:
                try:
                    metrics['stress'] = float(row['stress_avg'])
                except Exception:
                    pass

            if len(metrics) < 3:
                continue

            score = 0.0
            count = 0
            # RHR (lower is better)
            if 'rhr' in metrics:
                rhr_score = max(0.0, 100.0 - (metrics['rhr'] - 40.0) * 2.0)
                score += rhr_score
                count += 1
            # HRV (higher is better)
            if 'hrv' in metrics:
                hrv_score = min(100.0, metrics['hrv'] * 10.0)
                score += hrv_score
                count += 1
            # Sleep score
            if 'sleep_score' in metrics:
                score += metrics['sleep_score']
                count += 1
            # Energy level (scale to 100)
            if 'energy' in metrics:
                score += metrics['energy'] * 20.0
                count += 1
            # Stress (lower is better)
            if 'stress' in metrics:
                stress_score = max(0.0, 100.0 - metrics['stress'])
                score += stress_score
                count += 1

            if count > 0:
                day_val = row.get('day')
                if hasattr(day_val, 'isoformat'):
                    day_str = day_val.isoformat()
                else:
                    day_str = str(day_val)
                series.append({'day': day_str, 'score': round(score / count, 1)})
        # Sort ascending by date
        try:
            series.sort(key=lambda x: x['day'])
        except Exception:
            pass
        return series
    
    def get_comprehensive_health_data(self, days=90):
        """Get comprehensive health data for advanced analytics"""
        query = """
        SELECT 
            g.day,
            g.steps,
            g.calories_burned,
            g.resting_heart_rate as rhr,
            g.stress_avg,
            COALESCE(g.distance_meters/1000.0, g.activities_distance) as distance,
            NULL as floors_up,
            g.moderate_activity_time,
            g.vigorous_activity_time,
            -- Sleep metrics
            s.sleep_score,
            s.time_in_bed_minutes,
            s.deep_sleep,
            s.light_sleep,
            s.rem_sleep,
            s.awake,
            -- Journal metrics
            d.mood,
            d.energy_level,
            d.productivity_level,
            d.focus_concentration_level,
            d.stress_level_manual,
            d.sleep_quality_manual,
            d.overall_day_score,
            -- Advanced monitoring metrics
            hr_stats.avg_hr,
            hr_stats.min_hr,
            hr_stats.max_hr,
            COALESCE(d.hrv_manual, hr_stats.hr_variability) as hr_variability,
            d.hrv_manual AS hrv_manual_value,
            hr_stats.hr_variability AS hrv_variability_proxy,
            stress_stats.avg_stress,
            stress_stats.stress_variability,
            stress_stats.high_stress_periods,
            rr_stats.avg_rr,
            rr_stats.rr_variability,
            -- Weight data
            w.weight,
            -- Activity intensity metrics
            CASE 
                WHEN g.vigorous_activity_time > 60 THEN 'high'
                WHEN g.moderate_activity_time > 30 THEN 'moderate'
                ELSE 'low'
            END as activity_intensity,
            -- Recovery metrics
            CASE 
                WHEN g.resting_heart_rate < 50 THEN 'excellent'
                WHEN g.resting_heart_rate < 60 THEN 'good'
                WHEN g.resting_heart_rate < 70 THEN 'average'
                ELSE 'poor'
            END as recovery_status
        FROM garmin_daily_summaries g
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        LEFT JOIN garmin_weight w ON g.day = w.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(bpm) as avg_hr,
                MIN(bpm) as min_hr,
                MAX(bpm) as max_hr,
                STDDEV(bpm) as hr_variability
            FROM garmin_heart_rate_data 
            GROUP BY DATE(ts)
        ) hr_stats ON g.day = hr_stats.day
    -- manual_hrv removed; manual HRV now stored directly in daily_journal.hrv_ms
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(stress) as avg_stress,
                STDDEV(stress) as stress_variability,
                COUNT(CASE WHEN stress > 75 THEN 1 END) as high_stress_periods
            FROM garmin_stress_data 
            GROUP BY DATE(ts)
        ) stress_stats ON g.day = stress_stats.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(rr) as avg_rr,
                STDDEV(rr) as rr_variability
            FROM garmin_respiratory_rate_data 
            GROUP BY DATE(ts)
        ) rr_stats ON g.day = rr_stats.day
    -- Anchor window to latest day in daily summaries (broader coverage than sleep sessions)
    WHERE g.day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_daily_summaries) - INTERVAL '%s days'
        ORDER BY g.day DESC
        """
        
        return execute_query(query, (days,))
    
    def get_comprehensive_health_data_range(self, start_date, end_date):
        """Get comprehensive health data between dates (inclusive)."""
        query = """
        SELECT 
            g.day,
            g.steps,
            g.calories_burned,
            g.resting_heart_rate as rhr,
            g.stress_avg,
            COALESCE(g.distance_meters/1000.0, g.activities_distance) as distance,
            NULL as floors_up,
            g.moderate_activity_time,
            g.vigorous_activity_time,
            s.sleep_score,
            s.time_in_bed_minutes,
            s.deep_sleep,
            s.light_sleep,
            s.rem_sleep,
            s.awake,
            d.mood,
            d.energy_level,
            d.productivity_level,
            d.focus_concentration_level,
            d.stress_level_manual,
            d.sleep_quality_manual,
            d.overall_day_score,
            hr_stats.avg_hr,
            hr_stats.min_hr,
            hr_stats.max_hr,
            COALESCE(d.hrv_manual, hr_stats.hr_variability) as hr_variability,
            d.hrv_manual AS hrv_manual_value,
            hr_stats.hr_variability AS hrv_variability_proxy,
            stress_stats.avg_stress,
            stress_stats.stress_variability,
            stress_stats.high_stress_periods,
            rr_stats.avg_rr,
            rr_stats.rr_variability,
            w.weight,
            CASE 
                WHEN g.vigorous_activity_time > 60 THEN 'high'
                WHEN g.moderate_activity_time > 30 THEN 'moderate'
                ELSE 'low'
            END as activity_intensity,
            CASE 
                WHEN g.resting_heart_rate < 50 THEN 'excellent'
                WHEN g.resting_heart_rate < 60 THEN 'good'
                WHEN g.resting_heart_rate < 70 THEN 'average'
                ELSE 'poor'
            END as recovery_status
        FROM garmin_daily_summaries g
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        LEFT JOIN garmin_weight w ON g.day = w.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(bpm) as avg_hr,
                MIN(bpm) as min_hr,
                MAX(bpm) as max_hr,
                STDDEV(bpm) as hr_variability
            FROM garmin_heart_rate_data 
            GROUP BY DATE(ts)
        ) hr_stats ON g.day = hr_stats.day
    -- manual_hrv removed; manual HRV now stored directly in daily_journal.hrv_ms
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(stress) as avg_stress,
                STDDEV(stress) as stress_variability,
                COUNT(CASE WHEN stress > 75 THEN 1 END) as high_stress_periods
            FROM garmin_stress_data 
            GROUP BY DATE(ts)
        ) stress_stats ON g.day = stress_stats.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(rr) as avg_rr,
                STDDEV(rr) as rr_variability
            FROM garmin_respiratory_rate_data 
            GROUP BY DATE(ts)
        ) rr_stats ON g.day = rr_stats.day
        WHERE g.day >= %s AND g.day <= %s
        ORDER BY g.day ASC
        """
        return execute_query(query, (start_date, end_date))
    
    def get_recovery_trend_range(self, start_date, end_date):
        """Compute daily recovery score series for a date range (inclusive)."""
        data = self.get_comprehensive_health_data_range(start_date, end_date)
        if not data:
            return []
        series = []
        for row in data:
            metrics = {}
            if row.get('rhr') is not None:
                try:
                    metrics['rhr'] = float(row['rhr'])
                except Exception:
                    pass
            if row.get('hr_variability') is not None:
                try:
                    metrics['hrv'] = float(row['hr_variability'])
                except Exception:
                    pass
            if row.get('sleep_score') is not None:
                try:
                    metrics['sleep_score'] = float(row['sleep_score'])
                except Exception:
                    pass
            if row.get('energy_level') is not None:
                try:
                    metrics['energy'] = float(row['energy_level'])
                except Exception:
                    pass
            if row.get('stress_avg') is not None:
                try:
                    metrics['stress'] = float(row['stress_avg'])
                except Exception:
                    pass

            if len(metrics) < 3:
                continue

            score = 0.0
            count = 0
            if 'rhr' in metrics:
                rhr_score = max(0.0, 100.0 - (metrics['rhr'] - 40.0) * 2.0)
                score += rhr_score
                count += 1
            if 'hrv' in metrics:
                hrv_score = min(100.0, metrics['hrv'] * 10.0)
                score += hrv_score
                count += 1
            if 'sleep_score' in metrics:
                score += metrics['sleep_score']
                count += 1
            if 'energy' in metrics:
                score += metrics['energy'] * 20.0
                count += 1
            if 'stress' in metrics:
                stress_score = max(0.0, 100.0 - metrics['stress'])
                score += stress_score
                count += 1

            if count > 0:
                day_val = row.get('day')
                if hasattr(day_val, 'isoformat'):
                    day_str = day_val.isoformat()
                else:
                    day_str = str(day_val)
                series.append({'day': day_str, 'score': round(score / count, 1)})
        try:
            series.sort(key=lambda x: x['day'])
        except Exception:
            pass
        return series
    
    def get_comprehensive_health_data_v2(self, days=90):
        """Fetch the last N available data days starting from the most recent date.

        Previous behaviour: interval-based window anchored to MAX(day) which failed when
        there were large gaps (e.g. only 3 recent rows inside the last 90 calendar days).

        New behaviour: take the most recent N rows (days parameter) from garmin_daily_summaries
        regardless of gaps, then join auxiliary tables. This guarantees we always return up to
        N actual data days if they exist in the database.
        """
        query = """
        WITH recent_days AS (
            SELECT day
            FROM garmin_daily_summaries
            ORDER BY day DESC
            LIMIT %s
        )
        SELECT 
            g.day,
            g.steps,
            g.calories_burned,
            g.resting_heart_rate as rhr,
            g.stress_avg,
            -- Sleep metrics (convert seconds to minutes)
            s.sleep_score,
            (s.sleep_duration_seconds/60.0) as time_in_bed_minutes,
            (s.deep_sleep_seconds/60.0) as deep_sleep,
            (s.light_sleep_seconds/60.0) as light_sleep,
            (s.rem_sleep_seconds/60.0) as rem_sleep,
            (s.awake_seconds/60.0) as awake,
            -- Journal metrics
            d.mood,
            d.energy_level,
            d.productivity_level,
            d.focus_concentration_level,
            d.stress_level_manual,
            d.sleep_quality_manual,
            d.overall_day_score,
            -- Monitoring summaries
            hr_stats.avg_hr,
            hr_stats.min_hr,
            hr_stats.max_hr,
            COALESCE(d.hrv_manual, hr_stats.hr_variability) as hr_variability,
            d.hrv_manual AS hrv_manual_value,
            hr_stats.hr_variability AS hrv_variability_proxy,
            stress_stats.avg_stress,
            stress_stats.stress_variability,
            stress_stats.high_stress_periods,
            rr_stats.avg_rr,
            rr_stats.rr_variability
        FROM recent_days rd
        JOIN garmin_daily_summaries g ON g.day = rd.day
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(bpm) as avg_hr,
                MIN(bpm) as min_hr,
                MAX(bpm) as max_hr,
                STDDEV(bpm) as hr_variability
            FROM garmin_heart_rate_data 
            GROUP BY DATE(ts)
        ) hr_stats ON g.day = hr_stats.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(stress) as avg_stress,
                STDDEV(stress) as stress_variability,
                COUNT(CASE WHEN stress > 75 THEN 1 END) as high_stress_periods
            FROM garmin_stress_data 
            GROUP BY DATE(ts)
        ) stress_stats ON g.day = stress_stats.day
        LEFT JOIN (
            SELECT 
                DATE(ts) as day,
                AVG(rr) as avg_rr,
                STDDEV(rr) as rr_variability
            FROM garmin_respiratory_rate_data 
            GROUP BY DATE(ts)
        ) rr_stats ON g.day = rr_stats.day
        ORDER BY g.day DESC
        """
        rows = execute_query(query, (days,))
        # Compute overall available days (in case fewer than requested) using lightweight count
        try:
            total_days_result = execute_query("SELECT COUNT(*) as c FROM garmin_daily_summaries", ())
            total_days = total_days_result[0]['c'] if total_days_result else None
        except Exception:
            total_days = None
        if not rows:
            self.last_fetch_meta = {
                'requested_days': days,
                'returned_days': 0,
                'most_recent_day': None,
                'oldest_day': None,
                'available_total_days': total_days,
                'note': 'no_rows_returned'
            }
            return []
        # Normalize types
        for r in rows:
            if r.get('day') and hasattr(r['day'], 'isoformat'):
                pass  # keep date objects; API may format later
        most_recent = rows[0].get('day') if rows else None
        oldest = rows[-1].get('day') if rows else None
        self.last_fetch_meta = {
            'requested_days': days,
            'returned_days': len(rows),
            'most_recent_day': most_recent,
            'oldest_day': oldest,
            'available_total_days': total_days,
            'truncated': len(rows) < days and total_days is not None and total_days < days
        }
        return rows

    def calculate_advanced_correlations(self, data):
        """Calculate advanced correlation analysis including non-linear relationships.

        Changes (frontend fallback support):
        - Always return full structure with pearson/spearman/kendall/significant_correlations/insights/meta
        - Lower minimum data threshold from 10 -> 5 rows; if <5 provide meta.reason
        - Include meta diagnostics: rows, usable_fields, skipped_fields
        - Ensure matrix keys exist even if empty so frontend heatmap can still synthesize.
        """
        if not data:
            return {
                'pearson': {}, 'spearman': {}, 'kendall': {},
                'significant_correlations': [], 'insights': [],
                'meta': {'rows': 0, 'reason': 'no_data'}
            }
        if len(data) < 5:
            return {
                'pearson': {}, 'spearman': {}, 'kendall': {},
                'significant_correlations': [], 'insights': [],
                'meta': {'rows': len(data), 'reason': 'insufficient_rows', 'min_required': 5}
            }
        
        # Numeric fields for analysis
        numeric_fields = [
            'steps', 'calories_burned', 'rhr', 'stress_avg', 'sleep_score',
            'time_in_bed_minutes', 'deep_sleep', 'light_sleep', 'rem_sleep',
            'mood', 'energy_level', 'productivity_level', 'focus_concentration_level',
            'avg_hr', 'hr_variability', 'avg_stress', 'stress_variability',
            'avg_rr', 'weight'
        ]
        
        # Extract clean data
        clean_data = {}
        for field in numeric_fields:
            values = []
            for row in data:
                val = row.get(field)
                if val is not None:
                    try:
                        values.append(float(val))
                    except (ValueError, TypeError):
                        continue
            if len(values) >= 5:  # Minimum data points
                clean_data[field] = values
        
        correlations = {
            'pearson': {},
            'spearman': {},
            'kendall': {},
            'significant_correlations': [],
            'insights': [],
            'meta': {
                'rows': len(data),
                'candidate_fields': len(numeric_fields),
                'usable_fields': 0,
            }
        }
        
        # Calculate different types of correlations
        correlations['meta']['usable_fields'] = len(clean_data)

        for field1 in clean_data:
            correlations['pearson'][field1] = {}
            correlations['spearman'][field1] = {}
            correlations['kendall'][field1] = {}
            
            for field2 in clean_data:
                if field1 == field2:
                    correlations['pearson'][field1][field2] = 1.0
                    correlations['spearman'][field1][field2] = 1.0
                    correlations['kendall'][field1][field2] = 1.0
                    continue
                
                # Align data points
                aligned_data1, aligned_data2 = self._align_data_series(
                    clean_data[field1], clean_data[field2], data, field1, field2
                )
                
                if len(aligned_data1) >= 5:
                    try:
                        # Pearson correlation
                        pearson_r, pearson_p = stats.pearsonr(aligned_data1, aligned_data2)
                        correlations['pearson'][field1][field2] = round(pearson_r, 3)
                        
                        # Spearman correlation (rank-based, captures non-linear relationships)
                        spearman_r, spearman_p = stats.spearmanr(aligned_data1, aligned_data2)
                        correlations['spearman'][field1][field2] = round(spearman_r, 3)
                        
                        # Kendall's tau (robust to outliers)
                        kendall_tau, kendall_p = stats.kendalltau(aligned_data1, aligned_data2)
                        correlations['kendall'][field1][field2] = round(kendall_tau, 3)
                        
                        # Identify significant correlations
                        if abs(pearson_r) > 0.3 and pearson_p < 0.05:
                            correlations['significant_correlations'].append({
                                'field1': field1,
                                'field2': field2,
                                'correlation': round(pearson_r, 3),
                                'p_value': round(pearson_p, 4),
                                'strength': self._interpret_correlation_strength(pearson_r),
                                'type': 'pearson'
                            })
                        
                    except Exception:
                        correlations['pearson'][field1][field2] = None
                        correlations['spearman'][field1][field2] = None
                        correlations['kendall'][field1][field2] = None
        
        # Generate insights (after matrices built)
        correlations['insights'] = self._generate_correlation_insights(correlations['significant_correlations'])
        return correlations
    
    def _align_data_series(self, series1, series2, full_data, field1, field2):
        """Align two data series based on dates"""
        aligned1, aligned2 = [], []
        
        for _i, row in enumerate(full_data):
            val1 = row.get(field1)
            val2 = row.get(field2)
            
            if val1 is not None and val2 is not None:
                try:
                    aligned1.append(float(val1))
                    aligned2.append(float(val2))
                except (ValueError, TypeError):
                    continue
        
        return aligned1, aligned2
    
    def _interpret_correlation_strength(self, r):
        """Interpret correlation strength"""
        abs_r = abs(r)
        if abs_r >= 0.7:
            return 'strong'
        elif abs_r >= 0.5:
            return 'moderate'
        elif abs_r >= 0.3:
            return 'weak'
        else:
            return 'negligible'
    
    def _generate_correlation_insights(self, significant_correlations):
        """Generate human-readable insights from correlations"""
        insights = []
        
        for corr in significant_correlations:
            field1, field2 = corr['field1'], corr['field2']
            strength = corr['strength']
            direction = 'positive' if corr['correlation'] > 0 else 'negative'
            
            # Generate specific insights
            if field1 == 'sleep_score' and field2 == 'energy_level':
                insights.append(f"Sleep quality has a {strength} {direction} correlation with next-day energy levels")
            elif field1 == 'steps' and field2 == 'mood':
                insights.append(f"Daily activity shows a {strength} {direction} relationship with mood")
            elif field1 == 'stress_avg' and field2 == 'sleep_score':
                insights.append(f"Stress levels have a {strength} {direction} impact on sleep quality")
            elif field1 == 'rhr' and field2 == 'energy_level':
                insights.append(f"Resting heart rate shows a {strength} {direction} correlation with energy levels")
            else:
                insights.append(f"{field1.replace('_', ' ').title()} has a {strength} {direction} correlation with {field2.replace('_', ' ').title()}")
        
        return insights
    
    def perform_cluster_analysis(self, data, n_clusters=3):
        """Perform cluster analysis to identify health patterns"""
        if not data or len(data) < 10:
            return {}
        
        # Select features for clustering
        features = ['steps', 'sleep_score', 'mood', 'energy_level', 'rhr', 'stress_avg']
        
        # Prepare data matrix
        feature_matrix = []
        valid_indices = []
        
        for i, row in enumerate(data):
            feature_row = []
            valid = True
            
            for feature in features:
                val = row.get(feature)
                if val is not None:
                    try:
                        feature_row.append(float(val))
                    except (ValueError, TypeError):
                        valid = False
                        break
                else:
                    valid = False
                    break
            
            if valid:
                feature_matrix.append(feature_row)
                valid_indices.append(i)
        
        if len(feature_matrix) < n_clusters:
            return {'error': 'Insufficient data for clustering'}
        
        # Standardize features
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(feature_matrix)
        
        # Perform K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(scaled_features)
        
        # Analyze clusters
        clusters = {}
        for i in range(n_clusters):
            cluster_indices = [idx for idx, label in enumerate(cluster_labels) if label == i]
            cluster_data = [feature_matrix[idx] for idx in cluster_indices]
            
            if cluster_data:
                cluster_stats = {}
                for j, feature in enumerate(features):
                    values = [row[j] for row in cluster_data]
                    cluster_stats[feature] = {
                        'mean': round(mean(values), 2),
                        'std': round(stdev(values), 2) if len(values) > 1 else 0,
                        'min': round(min(values), 2),
                        'max': round(max(values), 2)
                    }
                
                clusters[f'cluster_{i}'] = {
                    'size': len(cluster_data),
                    'percentage': round(len(cluster_data) / len(feature_matrix) * 100, 1),
                    'characteristics': cluster_stats,
                    'interpretation': self._interpret_cluster(cluster_stats)
                }
        
        return {
            'total_data_points': len(feature_matrix),
            'clusters': clusters,
            'features_used': features
        }
    
    def _interpret_cluster(self, cluster_stats):
        """Interpret cluster characteristics"""
        interpretations = []
        
        # High activity cluster
        if cluster_stats.get('steps', {}).get('mean', 0) > 12000:
            interpretations.append("High activity days")
        
        # Good sleep cluster
        if cluster_stats.get('sleep_score', {}).get('mean', 0) > 80:
            interpretations.append("Excellent sleep quality")
        
        # High mood/energy cluster
        if (cluster_stats.get('mood', {}).get('mean', 0) > 4 and 
            cluster_stats.get('energy_level', {}).get('mean', 0) > 4):
            interpretations.append("High wellbeing days")
        
        # Low stress cluster
        if cluster_stats.get('stress_avg', {}).get('mean', 100) < 30:
            interpretations.append("Low stress periods")
        
        # Recovery cluster
        if cluster_stats.get('rhr', {}).get('mean', 100) < 55:
            interpretations.append("Good recovery state")
        
        return interpretations if interpretations else ["Mixed characteristics"]
    
    def analyze_temporal_patterns(self, data):
        """Analyze temporal patterns and trends"""
        if not data:
            return {}
        
        # Group by day of week
        day_patterns = {}
        for i in range(7):
            day_patterns[i] = {'steps': [], 'mood': [], 'energy_level': [], 'sleep_score': []}
        
        # Group by week
        weekly_trends = {}
        
        for row in data:
            if row.get('day'):
                day_date = row['day']
                if hasattr(day_date, 'weekday'):
                    dow = day_date.weekday()
                    week_num = day_date.isocalendar()[1]
                    
                    # Day of week patterns
                    for metric in ['steps', 'mood', 'energy_level', 'sleep_score']:
                        val = row.get(metric)
                        if val is not None:
                            try:
                                day_patterns[dow][metric].append(float(val))
                            except (ValueError, TypeError):
                                continue
                    
                    # Weekly trends
                    if week_num not in weekly_trends:
                        weekly_trends[week_num] = {'steps': [], 'mood': [], 'energy_level': []}
                    
                    for metric in ['steps', 'mood', 'energy_level']:
                        val = row.get(metric)
                        if val is not None:
                            try:
                                weekly_trends[week_num][metric].append(float(val))
                            except (ValueError, TypeError):
                                continue
        
        # Calculate day of week averages
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        dow_analysis = {}
        
        for dow, day_name in enumerate(day_names):
            dow_analysis[day_name] = {}
            for metric in ['steps', 'mood', 'energy_level', 'sleep_score']:
                values = day_patterns[dow][metric]
                if values:
                    dow_analysis[day_name][metric] = {
                        'mean': round(mean(values), 2),
                        'std': round(stdev(values), 2) if len(values) > 1 else 0,
                        'count': len(values)
                    }
        
        # Calculate weekly trends
        weekly_analysis = {}
        for week, metrics in weekly_trends.items():
            weekly_analysis[week] = {}
            for metric, values in metrics.items():
                if values:
                    weekly_analysis[week][metric] = round(mean(values), 2)
        
        return {
            'day_of_week_patterns': dow_analysis,
            'weekly_trends': weekly_analysis,
            'insights': self._generate_temporal_insights(dow_analysis)
        }
    
    def _generate_temporal_insights(self, dow_analysis):
        """Generate insights from temporal patterns"""
        insights = []
        
        # Find best and worst days
        day_scores = {}
        for day, metrics in dow_analysis.items():
            score = 0
            count = 0
            for metric in ['mood', 'energy_level']:
                if metric in metrics:
                    score += metrics[metric]['mean']
                    count += 1
            if count > 0:
                day_scores[day] = score / count
        
        if day_scores:
            best_day = max(day_scores, key=day_scores.get)
            worst_day = min(day_scores, key=day_scores.get)
            
            insights.append(f"Best wellbeing day: {best_day}")
            insights.append(f"Most challenging day: {worst_day}")
        
        # Activity patterns
        activity_scores = {}
        for day, metrics in dow_analysis.items():
            if 'steps' in metrics:
                activity_scores[day] = metrics['steps']['mean']
        
        if activity_scores:
            most_active = max(activity_scores, key=activity_scores.get)
            least_active = min(activity_scores, key=activity_scores.get)
            
            insights.append(f"Most active day: {most_active}")
            insights.append(f"Least active day: {least_active}")
        
        return insights
    
    def analyze_recovery_patterns(self, data):
        """Analyze recovery patterns and fatigue indicators"""
        if not data:
            return {}
        
        recovery_data = []
    # Forward-fill manual HRV logic: use last provided hrv_manual for subsequent days
        # until next manual value appears (optionally capped by HRV_FFILL_MAX_DAYS env var).
        from datetime import date as _date, datetime as _dt
        ffill_limit_env = os.getenv('HRV_FFILL_MAX_DAYS')
        try:
            ffill_limit_days = int(ffill_limit_env) if ffill_limit_env else None
        except Exception:
            ffill_limit_days = None
        last_manual_hrv = None
        last_manual_day = None
        for row in data:
            recovery_metrics = {}
            # Preserve day for trend plotting if available
            if 'day' in row:
                recovery_metrics['day'] = row['day']
            
            # Key recovery indicators
            if row.get('rhr'):
                recovery_metrics['rhr'] = float(row['rhr'])
            # HRV selection with forward-fill preference for manual entries
            hrv_manual = row.get('hrv_manual_value')
            hrv_proxy = row.get('hrv_variability_proxy')  # STDDEV(bpm) legacy proxy
            chosen_hrv = None
            hrv_source = None
            # Day parsing for gap calculation
            current_day_obj = None
            _day_raw = row.get('day')
            if _day_raw is not None:
                if hasattr(_day_raw, 'isoformat'):
                    current_day_obj = _day_raw
                else:
                    try:
                        current_day_obj = _dt.fromisoformat(str(_day_raw)).date()
                    except Exception:
                        current_day_obj = None
            if hrv_manual is not None:
                try:
                    chosen_hrv = float(hrv_manual)
                    hrv_source = 'manual_journal'
                    last_manual_hrv = chosen_hrv
                    last_manual_day = current_day_obj
                except Exception:
                    pass
            else:
                # Forward-fill if we have a previous manual
                if last_manual_hrv is not None and last_manual_day is not None:
                    allow_ffill = True
                    if ffill_limit_days is not None and current_day_obj and isinstance(current_day_obj, _date) and isinstance(last_manual_day, _date):
                        delta_days = (current_day_obj - last_manual_day).days
                        if delta_days > ffill_limit_days:
                            allow_ffill = False
                    if allow_ffill:
                        chosen_hrv = last_manual_hrv
                        hrv_source = 'manual_ffill'
                # If still none, fallback to proxy
                if chosen_hrv is None and hrv_proxy is not None:
                    try:
                        chosen_hrv = float(hrv_proxy)
                        hrv_source = 'garmin_stddev_proxy'
                    except Exception:
                        pass
            if chosen_hrv is not None:
                recovery_metrics['hrv'] = chosen_hrv
                recovery_metrics['_hrv_source'] = hrv_source
            if row.get('sleep_score'):
                recovery_metrics['sleep_score'] = float(row['sleep_score'])
            if row.get('energy_level'):
                recovery_metrics['energy'] = float(row['energy_level'])
            if row.get('stress_avg'):
                recovery_metrics['stress'] = float(row['stress_avg'])
            if row.get('avg_rr') is not None:
                try:
                    recovery_metrics['resp_rate'] = float(row['avg_rr'])
                except Exception:
                    pass
            
            if len(recovery_metrics) >= 3:  # Need at least 3 metrics
                recovery_data.append(recovery_metrics)
        
        if len(recovery_data) < 5:
            return {'error': 'Insufficient recovery data'}
        
        # Extended component-based recovery scoring
        # -------------------------------------------------
        # Components (each 0-100 normalized):
        #  - rhr_component: adaptive to median of full window (penalize > baseline)
        #  - hrv_component: relative to 75th percentile (cap) for positive scaling
        #  - sleep_component: direct sleep_score
        #  - stress_component: inverted stress (100-stress)
        #  - energy_component: energy_level * 20
        #  - variability_component: stability of RHR & HRV (lower stdev -> higher score)
        #  - activity_balance_component: derived from steps & moderate/vigorous time if available (placeholder here)
        # Weighted composite => recovery_score_v2

        def _safe_list(key):
            vals = []
            for m in recovery_data:
                if key in m and m[key] is not None:
                    try:
                        vals.append(float(m[key]))
                    except Exception:
                        pass
            return vals
        import statistics as _stats
        rhrs_all = _safe_list('rhr')
        hrvs_all_raw = _safe_list('hrv')
        sleep_all = _safe_list('sleep_score')
        stress_all = _safe_list('stress')
        energy_all = _safe_list('energy')

        def _pct(arr, p):
            if not arr:
                return None
            arr_sorted = sorted(arr)
            k = (len(arr_sorted)-1) * (p/100.0)
            f = int(k)
            c = min(f+1, len(arr_sorted)-1)
            if f == c:
                return arr_sorted[f]
            return arr_sorted[f] + (arr_sorted[c]-arr_sorted[f])*(k-f)

        # Winsorization helper
        def _winsor(arr, low=5, high=95):
            if not arr:
                return []
            p_low = _pct(arr, low)
            p_high = _pct(arr, high)
            if p_low is None or p_high is None or p_low >= p_high:
                return arr[:]
            return [min(max(v, p_low), p_high) for v in arr]

        # Apply winsorization to HRV distribution before deriving caps/baselines
        hrvs_all_w = _winsor(hrvs_all_raw, 5, 95)
        hrvs_all = hrvs_all_w  # downstream naming consistency

        rhr_baseline = _pct(rhrs_all, 40) if rhrs_all else None  # global reference (legacy)
        hrv_cap = _pct(hrvs_all, 75) if hrvs_all else None
        rhr_stdev = (_stats.stdev(rhrs_all) if len(rhrs_all) > 1 else 0) if rhrs_all else None
        hrv_stdev = (_stats.stdev(hrvs_all) if len(hrvs_all) > 1 else 0) if hrvs_all else None

        # Rolling median baselines per day (window=14) for adaptive scoring
        rolling_rhr_baselines = []  # list of baselines (median of prev window)
        rolling_hrv_baselines = []
        window = 14
        # Build simple aligned arrays preserving order of recovery_data
        rhr_sequence = [m.get('rhr') for m in recovery_data]
        hrv_sequence = [m.get('hrv') for m in recovery_data]
        def _rolling_median(seq, i):
            start = max(0, i - window)
            subset = [v for v in seq[start:i] if v is not None]
            if len(subset) < 5:  # need enough history
                return None
            s = sorted(subset)
            mid = len(s)//2
            if len(s) % 2 == 1:
                return s[mid]
            return (s[mid-1]+s[mid])/2.0
        for i,_row in enumerate(recovery_data):
            rb = _rolling_median(rhr_sequence, i)
            hb = _rolling_median(hrv_sequence, i)
            rolling_rhr_baselines.append(rb)
            rolling_hrv_baselines.append(hb)

        # Build EMA for HRV (used after sufficient history for adaptive cap)
        hrv_ema_series = []
        ema_alpha = 0.1
        for v in hrv_sequence:
            if v is None:
                # propagate previous ema (do not update)
                hrv_ema_series.append(hrv_ema_series[-1] if hrv_ema_series else None)
            else:
                if not hrv_ema_series or hrv_ema_series[-1] is None:
                    hrv_ema_series.append(v)
                else:
                    prev = hrv_ema_series[-1]
                    hrv_ema_series.append(prev + ema_alpha*(v - prev))

        # VO2max & respiratory (avg_rr) if present in raw dataset (data rows, not reduced recovery_data)
        # Attempt extraction from original 'data' list (comprehensive rows)
        vo2_values = []
        rr_values = []
        for row in data:
            # common possible keys for VO2max metrics
            for k in ('vo2max','vo2_max','vo2_maximum'):
                if k in row and row[k] is not None:
                    try:
                        vo2_values.append(float(row[k]))
                    except Exception:
                        pass
            if row.get('avg_rr') is not None:
                try:
                    rr_values.append(float(row['avg_rr']))
                except Exception:
                    pass
        vo2_cap = _pct(vo2_values, 80) if vo2_values else None
        rr_baseline = _pct(rr_values, 50) if rr_values else None  # median reference

        def _norm_rhr(val, idx=None):
            if val is None:
                return None
            adaptive = None
            if idx is not None and 0 <= idx < len(rolling_rhr_baselines):
                adaptive = rolling_rhr_baselines[idx]
            baseline_use = adaptive if adaptive is not None else rhr_baseline
            if baseline_use is None:
                return None
            diff = val - baseline_use
            raw = 100.0 - max(0.0, diff) * 2.0
            return max(0.0, min(100.0, raw))

        def _norm_hrv_info(val, idx=None):
            """Return dict with normalized score + baseline + cap + raw.
            Scaling: exponent 0.7; after >=30 days prefer dynamic cap derived from EMA (ema*1.15).
            """
            if val is None:
                return {'score': None, 'baseline': None, 'cap': None, 'raw': None}
            adaptive = None
            if idx is not None and 0 <= idx < len(rolling_hrv_baselines):
                adaptive = rolling_hrv_baselines[idx]
            # base cap (percentile-based)
            cap_use = hrv_cap
            if adaptive and adaptive > 0:
                cap_use = max(adaptive*1.2, cap_use or adaptive*1.2)
            # Dynamic EMA-based cap after >=30 samples with EMA present
            if len(hrvs_all_raw) >= 30 and idx is not None and idx < len(hrv_ema_series):
                ema_val = hrv_ema_series[idx]
                if ema_val and ema_val > 0:
                    cap_use = max(cap_use or 0, ema_val*1.15)
            if cap_use is None or cap_use <= 0:
                return {'score': None, 'baseline': adaptive, 'cap': None, 'raw': val}
            ratio = val / cap_use
            # Exponent scaling for softer saturation
            scaled = (ratio ** 0.7) * 100.0
            score = max(0.0, min(100.0, scaled))
            return {'score': score, 'baseline': adaptive, 'cap': cap_use, 'raw': val}

        def _norm_vo2(val):
            if val is None:
                return None
            ref = vo2_cap if vo2_cap else val
            if ref <= 0:
                return None
            raw = (val / ref) * 100.0
            return max(0.0, min(100.0, raw))

        def _norm_rr(val):
            # Lower respiratory rate (within normal bounds) implies better recovery; deviations penalize
            if val is None or rr_baseline is None:
                return None
            # U-curve: penalty for both high and abnormally low (e.g., < baseline - 2)
            diff = val - rr_baseline
            # Base near 95
            raw = 95.0
            if diff > 0:  # elevated
                raw -= diff * 5.0
            elif diff < -2:  # significantly suppressed (could indicate over-fatigue or measurement anomaly)
                raw -= (abs(diff) - 2) * 7.0
            return max(0.0, min(100.0, raw))

        def _variability_score():
            # Combine RHR & HRV variability (lower stdev => better). If missing, ignore.
            parts = []
            if rhr_stdev is not None:
                # Assume 0-8 bpm range typical; map 0 ->100, 8 -> 0
                parts.append(max(0.0, min(100.0, 100.0 - (rhr_stdev / 8.0) * 100.0)))
            if hrv_stdev is not None:
                # Assume 0-15 ms stdev typical; map 0 ->100, 15 -> 0
                parts.append(max(0.0, min(100.0, 100.0 - (hrv_stdev / 15.0) * 100.0)))
            if not parts:
                return None
            return round(sum(parts)/len(parts),1)

        variability_component = _variability_score()

        # Activity balance placeholder (needs steps + intensity; using energy as proxy if present)
        # If energy moderate (3-4) and stress not high contribute positively.
        def _activity_balance(m):
            e = m.get('energy')
            s = m.get('stress')
            if e is None or s is None:
                return None
            if 3 <= e <= 4 and s < 55:
                return 90.0
            if e >= 4 and s < 60:
                return 80.0
            if e < 2 and s > 65:
                return 40.0
            return 70.0

        component_breakdown_series = []  # list of dicts (per day)
        component_trend_series = []  # enriched with day + core components
        recovery_scores = []  # legacy simple average kept for backward compatibility
        recovery_scores_v2 = []  # new composite

        # Weights (sum ~ 1): adjust emphasis
        weights = {
            'rhr': 0.16,
            'hrv': 0.16,
            'sleep': 0.18,
            'stress': 0.12,
            'energy': 0.12,
            'variability': 0.06,
            'activity_balance': 0.05,
            'vo2max': 0.08,
            'respiratory': 0.07,
        }

        for idx, metrics in enumerate(recovery_data):
            # --- Original simple average (legacy) ---
            legacy_score = 0.0
            legacy_n = 0
            if 'rhr' in metrics:
                s_rhr = max(0, 100 - (metrics['rhr'] - 40) * 2)
                legacy_score += s_rhr; legacy_n += 1
            if 'hrv' in metrics:
                s_hrv = min(100, metrics['hrv'] * 10)
                legacy_score += s_hrv; legacy_n += 1
            if 'sleep_score' in metrics:
                legacy_score += metrics['sleep_score']; legacy_n += 1
            if 'energy' in metrics:
                legacy_score += metrics['energy'] * 20; legacy_n += 1
            if 'stress' in metrics:
                legacy_score += max(0, 100 - metrics['stress']); legacy_n += 1
            if legacy_n > 0:
                recovery_scores.append(legacy_score / legacy_n)

            # --- Extended component model ---
            comp = {}
            rhr_v = metrics.get('rhr'); hrv_v = metrics.get('hrv'); ss_v = metrics.get('sleep_score'); en_v = metrics.get('energy'); st_v = metrics.get('stress')
            comp['rhr_component'] = _norm_rhr(rhr_v, idx) if rhr_v is not None else None
            if hrv_v is not None:
                _hrv_info = _norm_hrv_info(hrv_v, idx)
                comp['hrv_component'] = _hrv_info['score']
                comp['hrv_raw'] = _hrv_info['raw']
                comp['hrv_baseline'] = _hrv_info['baseline']
                comp['hrv_cap'] = _hrv_info['cap']
                comp['hrv_source'] = metrics.get('_hrv_source')
            else:
                comp['hrv_component'] = None
            comp['sleep_component'] = ss_v if ss_v is not None else None
            comp['stress_component'] = (100.0 - st_v) if st_v is not None else None
            comp['energy_component'] = en_v * 20.0 if en_v is not None else None
            comp['variability_component'] = variability_component
            comp['activity_balance_component'] = _activity_balance(metrics)
            # New optional components
            # VO2max may be in original row set but not in reduced metrics; we attempt mapping by index (same ordering assumption)
            vo2_val = None
            if idx < len(data):
                for k in ('vo2max','vo2_max','vo2_maximum'):
                    if k in data[idx] and data[idx][k] is not None:
                        try:
                            vo2_val = float(data[idx][k])
                            break
                        except Exception:
                            pass
            rr_val = None
            if idx < len(data) and data[idx].get('avg_rr') is not None:
                try:
                    rr_val = float(data[idx]['avg_rr'])
                except Exception:
                    pass
            comp['vo2max_component'] = _norm_vo2(vo2_val) if vo2_val is not None else None
            comp['respiratory_component'] = _norm_rr(rr_val) if rr_val is not None else None

            # Weighted sum over available components (renormalize weights)
            # Only consider actual numeric component scores (end with _component or explicit known keys)
            available = []
            for k,v in comp.items():
                if v is None:
                    continue
                if k.endswith('_component'):
                    available.append((k,v))
                # (Do NOT include metadata like hrv_source here)
            if available:
                total_w = sum(weights.get(k.replace('_component',''),0) for k,_ in available)
                if total_w > 0:
                    composite_acc = 0.0
                    for k,v in available:
                        try:
                            fv = float(v)
                        except Exception:
                            continue
                        w = weights.get(k.replace('_component',''),0)
                        if w <= 0:
                            continue
                        composite_acc += fv * (w/total_w)
                    if composite_acc:
                        recovery_scores_v2.append(composite_acc)
                        comp['composite_score'] = round(composite_acc,1)
            component_breakdown_series.append(comp)
            # Add trend row (limit set later to last N days)
            trend_row = {
                'day': metrics.get('day', idx),
                'rhr': comp.get('rhr_component'),
                'hrv': comp.get('hrv_component'),
                'hrv_raw': comp.get('hrv_raw'),
                'hrv_source': comp.get('hrv_source'),
                'hrv_baseline': comp.get('hrv_baseline'),
                'hrv_cap': comp.get('hrv_cap'),
                'sleep': comp.get('sleep_component'),
                'stress': comp.get('stress_component'),
                'energy': comp.get('energy_component'),
                'vo2max': comp.get('vo2max_component'),
                'respiratory': comp.get('respiratory_component'),
                'composite': comp.get('composite_score')
            }
            component_trend_series.append(trend_row)
        
        # --- Post-process: add 3-day rolling median smoothing for hrv_raw ---
        def _rolling_median_simple(values, window=3):
            out = []
            from statistics import median
            for i in range(len(values)):
                window_vals = [v for v in values[max(0,i-window+1):i+1] if v is not None]
                if window_vals:
                    try:
                        out.append(median(window_vals))
                    except Exception:
                        out.append(window_vals[-1])
                else:
                    out.append(None)
            return out
        hrv_raw_series = [r.get('hrv_raw') for r in component_trend_series]
        hrv_raw_smoothed = _rolling_median_simple(hrv_raw_series, 3)
        for i, sm in enumerate(hrv_raw_smoothed):
            component_trend_series[i]['hrv_raw_smoothed'] = sm

        # Analyze recovery trends
        if recovery_scores:
            recent_scores = recovery_scores[-7:]
            older_scores = recovery_scores[:-7] if len(recovery_scores) > 7 else []

            # Prefer v2 composite for current score if available
            curr_series = recovery_scores_v2 if recovery_scores_v2 else recovery_scores
            recent_v2 = curr_series[-7:] if len(curr_series) >= 7 else curr_series
            older_v2 = curr_series[:-7] if len(curr_series) > 7 else []

            current_score = round(mean(recent_v2),1) if recent_v2 else None
            # Full component series retained; provide a configurable tail window for lightweight UI use.
            # RECOVERY_TREND_TAIL_DAYS env var (default 30) controls legacy tail length.
            # Additional env var RECOVERY_TREND_MAX_DAYS (optional) can cap how many days of full series we expose (default: no cap)
            try:
                tail_days = int(os.getenv('RECOVERY_TREND_TAIL_DAYS', '30'))
                if tail_days < 1:
                    tail_days = 30
            except Exception:
                tail_days = 30
            try:
                max_full_days = os.getenv('RECOVERY_TREND_MAX_DAYS')
                max_full_days = int(max_full_days) if max_full_days else None
                if max_full_days is not None and max_full_days < 1:
                    max_full_days = None
            except Exception:
                max_full_days = None

            full_component_series = component_trend_series if max_full_days is None else component_trend_series[-max_full_days:]
            trend_tail = component_trend_series[-tail_days:]

            # Build full trend_series (all available) and legacy tail trend_series (backward compatible)
            full_trend_series = [
                {
                    'day': row.get('day'),
                    'score': row.get('composite') if row.get('composite') is not None else (
                        (lambda comps: (sum(comps)/len(comps)) if comps else None)([
                            v for k,v in row.items() if k in ('rhr','hrv','sleep','stress','energy','vo2max','respiratory') and v is not None
                        ])
                    )
                }
                for row in full_component_series if row.get('composite') is not None or any(row.get(k) is not None for k in ('rhr','hrv','sleep','stress','energy','vo2max','respiratory'))
            ]

            # Latest HRV contextual fields (raw/baseline/cap/component)
            latest_hrv_raw = component_breakdown_series[-1].get('hrv_raw') if component_breakdown_series else None
            latest_hrv_source = component_trend_series[-1].get('hrv_source') if component_trend_series else None
            latest_hrv_baseline = component_breakdown_series[-1].get('hrv_baseline') if component_breakdown_series else None
            latest_hrv_cap = component_breakdown_series[-1].get('hrv_cap') if component_breakdown_series else None
            latest_hrv_component = component_trend_series[-1].get('hrv') if component_trend_series else None
            latest_hrv_raw_smoothed = component_trend_series[-1].get('hrv_raw_smoothed') if component_trend_series else None

            analysis = {
                'scoring_version': '2.0',
                'current_recovery_score': current_score,
                'recovery_trend': 'improving' if (older_v2 and mean(recent_v2) > mean(older_v2)) else 'stable',
                # HRV normalization context (latest)
                'hrv_current_raw': latest_hrv_raw,
                'hrv_current_baseline_adaptive': latest_hrv_baseline,
                'hrv_current_cap_use': latest_hrv_cap,
                # Added explicit top-level aliases for frontend direct consumption
                'hrv_raw': latest_hrv_raw,
                'hrv_source': latest_hrv_source,
                'hrv_baseline': latest_hrv_baseline,
                'hrv_cap': latest_hrv_cap,
                'hrv_component': latest_hrv_component,
                'hrv_raw_smoothed': latest_hrv_raw_smoothed,
                'best_recovery_score': round(max(curr_series), 1),
                'worst_recovery_score': round(min(curr_series), 1),
                'recovery_consistency': round(100 - (stdev(curr_series) / mean(curr_series) * 100), 1) if len(curr_series) > 1 else 100,
                'component_breakdown_latest': component_breakdown_series[-1] if component_breakdown_series else {},
                'component_breakdown_samples': len(component_breakdown_series),
                # Full & tail component series
                'component_trend_series_full': full_component_series,
                'component_trend_series': trend_tail,  # backward compatible
                # Full & tail trend series (scores)
                'trend_series_full': full_trend_series,
                'trend_series': [  # backward compatible (tail)
                    {
                        'day': row.get('day'),
                        'score': row.get('composite') if row.get('composite') is not None else (
                            (lambda comps: (sum(comps)/len(comps)) if comps else None)([
                                v for k,v in row.items() if k in ('rhr','hrv','sleep','stress','energy','vo2max','respiratory') and v is not None
                            ])
                        )
                    }
                    for row in trend_tail if row.get('composite') is not None or any(row.get(k) is not None for k in ('rhr','hrv','sleep','stress','energy','vo2max','respiratory'))
                ],
                'trend_tail_days': tail_days,
                'trend_full_days': len(full_trend_series),
                'dynamic_baseline': {
                    'rolling_window_days': 14,
                    'rhr_baseline_global': rhr_baseline,
                    'hrv_cap_global': hrv_cap,
                    'hrv_ema_last': hrv_ema_series[-1] if hrv_ema_series else None,
                    'vo2_cap': vo2_cap,
                    'rr_baseline': rr_baseline,
                }
            }

            # Deviation events detection (last ~30 days window)
            deviation_events = []
            def _add_event(kind, day, magnitude, direction, note):
                deviation_events.append({
                    'type': kind,
                    'day': day,
                    'magnitude': round(magnitude,2) if magnitude is not None else None,
                    'direction': direction,
                    'note': note
                })

            # HRV deviations using raw vs adaptive baseline (if available) thresholds
            # drop: raw/baseline < 0.85; spike: raw/baseline > 1.15
            for row in component_trend_series:
                raw = row.get('hrv_raw_smoothed') or row.get('hrv_raw')
                base = row.get('hrv_baseline')
                if raw is None or base is None or base <= 0:
                    continue
                ratio = raw / base
                pct_dev = (raw - base) / base * 100.0
                # Avoid trivial noise: require absolute deviation > 5% as minimum safeguard
                if ratio < 0.85 and abs(pct_dev) >= 5:
                    _add_event('hrv_drop', row.get('day'), pct_dev, 'down', 'HRV raw <85% of adaptive baseline')
                elif ratio > 1.15 and abs(pct_dev) >= 5:
                    _add_event('hrv_spike', row.get('day'), pct_dev, 'up', 'HRV raw >115% of adaptive baseline')

            # Elevated / suppressed RHR component meaning underlying RHR pattern (component <60 two times in 3 days)
            rhr_components = [r.get('rhr') for r in component_trend_series]
            for i in range(2, len(rhr_components)):
                recent = [v for v in rhr_components[i-2:i+1] if v is not None]
                if len(recent) == 3 and sum(1 for v in recent if v < 60) >= 2:
                    day_val = component_trend_series[i]['day']
                    _add_event('rhr_elevated', day_val, None, 'up', 'RHR component suppressed (<60) in >=2 of last 3 days')

            # Respiratory anomaly: component <65 or >90 (extremes) for 2 consecutive days
            resp_components = [r.get('respiratory') for r in component_trend_series]
            streak = 0
            for i,v in enumerate(resp_components):
                if v is not None and (v < 65 or v > 95):
                    streak += 1
                    if streak >= 2:
                        day_val = component_trend_series[i]['day']
                        _add_event('resp_rate_deviation', day_val, v, 'low' if v < 65 else 'high', 'Respiratory component out-of-range 2 consecutive days')
                else:
                    streak = 0
            if deviation_events:
                analysis['deviation_events'] = deviation_events

            # Recommendations (extend with component insights)
            recommendations = []
            if analysis['current_recovery_score'] and analysis['current_recovery_score'] < 60:
                recommendations.append("Consider prioritizing sleep & stress management (low composite score)")
            if analysis['recovery_consistency'] < 70:
                recommendations.append("Improve day-to-day consistency (high variability)")
            if analysis['recovery_trend'] == 'declining':
                recommendations.append("Trend declining – evaluate load vs recovery balance")
            latest_comp = analysis.get('component_breakdown_latest', {})
            if latest_comp.get('sleep_component') and latest_comp['sleep_component'] < 70:
                recommendations.append("Sleep quality dragging recovery – optimize sleep hygiene")
            if latest_comp.get('rhr_component') and latest_comp['rhr_component'] < 60:
                recommendations.append("Elevated resting HR – schedule lighter day")
            if latest_comp.get('stress_component') and latest_comp['stress_component'] < 55:
                recommendations.append("High stress load – integrate relaxation techniques")
            if latest_comp.get('hrv_component') and latest_comp['hrv_component'] < 50:
                recommendations.append("Low HRV – prioritize restorative activities")
            if latest_comp.get('vo2max_component') and latest_comp['vo2max_component'] < 60:
                recommendations.append("VO2max below recent potential – consider aerobic base training phase")
            if latest_comp.get('respiratory_component') and latest_comp['respiratory_component'] < 60:
                recommendations.append("Elevated respiratory rate vs baseline – monitor fatigue / recovery status")
            analysis['recommendations'] = recommendations[:6]

            return analysis

        return {'error': 'Unable to calculate recovery scores'}
    
    def get_comprehensive_insights(self, days=90):
        """Get comprehensive health insights with enhanced analytics"""
        insights = {
            'data_summary': {},
            'advanced_correlations': {},
            'cluster_analysis': {},
            'temporal_patterns': {},
            'recovery_analysis': {},
            'predictive_insights': {},
            'recommendations': []
        }
        
        # Get comprehensive data
        data = self.get_comprehensive_health_data_v2(days)
        if not data:
            return {'error': 'No data available'}
        
        insights['data_summary'] = {
            'total_days': len(data),
            'date_range': f"{data[-1]['day']} to {data[0]['day']}" if data else "No data"
        }
        
        # Advanced correlations
        insights['advanced_correlations'] = self.calculate_advanced_correlations(data)
        
        # Cluster analysis
        insights['cluster_analysis'] = self.perform_cluster_analysis(data)
        
        # Temporal patterns
        insights['temporal_patterns'] = self.analyze_temporal_patterns(data)
        
        # Recovery analysis
        insights['recovery_analysis'] = self.analyze_recovery_patterns(data)
        
        # Generate overall recommendations
        insights['recommendations'] = self._generate_comprehensive_recommendations(insights)
        
        return insights
    
    def _generate_comprehensive_recommendations(self, insights):
        """Generate comprehensive health recommendations"""
        recommendations = []
        
        # From correlations
        if insights.get('advanced_correlations', {}).get('insights'):
            for insight in insights['advanced_correlations']['insights'][:3]:
                recommendations.append(f"Focus area: {insight}")
        
        # From temporal patterns
        if insights.get('temporal_patterns', {}).get('insights'):
            for insight in insights['temporal_patterns']['insights'][:2]:
                recommendations.append(f"Schedule optimization: {insight}")
        
        # From recovery analysis
        if insights.get('recovery_analysis', {}).get('recommendations'):
            recommendations.extend(insights['recovery_analysis']['recommendations'][:2])
        
        # From cluster analysis
        clusters = insights.get('cluster_analysis', {}).get('clusters', {})
        if clusters:
            largest_cluster = max(clusters.keys(), key=lambda k: clusters[k]['size'])
            cluster_info = clusters[largest_cluster]
            if cluster_info.get('interpretation'):
                recommendations.append(f"Primary pattern: {', '.join(cluster_info['interpretation'])}")
        
        return recommendations[:5]  # Limit to top 5 recommendations

def main():
    """Test the enhanced analytics engine"""
    analytics = EnhancedHealthAnalytics()
    
    print("🧠 Running enhanced health analytics...")
    insights = analytics.get_comprehensive_insights(60)
    
    print("\n📊 Enhanced Analytics Results:")
    print(f"✅ Data points analyzed: {insights.get('data_summary', {}).get('total_days', 0)}")
    
    if insights.get('advanced_correlations', {}).get('significant_correlations'):
        print(f"🔗 Significant correlations found: {len(insights['advanced_correlations']['significant_correlations'])}")
    
    if insights.get('cluster_analysis', {}).get('clusters'):
        print(f"📊 Health patterns identified: {len(insights['cluster_analysis']['clusters'])} clusters")
    
    if insights.get('recovery_analysis', {}).get('current_recovery_score'):
        print(f"💪 Current recovery score: {insights['recovery_analysis']['current_recovery_score']}/100")
    
    if insights.get('recommendations'):
        print(f"💡 Recommendations generated: {len(insights['recommendations'])}")
    
    print("\n💾 Full enhanced insights available")
    return insights

if __name__ == '__main__':
    main()