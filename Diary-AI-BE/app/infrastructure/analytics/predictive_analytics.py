from datetime import timedelta
import math
import os
from statistics import mean
import warnings

from dotenv import load_dotenv
import numpy as np
from db import execute_query
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit, RandomizedSearchCV
from scipy.stats import randint, uniform
from model_utils import save_model, load_model, model_path
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')

# Load environment variables
load_dotenv('config.env')

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'diary'),
    'user': os.getenv('DB_USER', 'diary_user'),
    'password': os.getenv('DB_PASSWORD', 'diary123')
}

def execute_query(query, params=None, fetch_one=False, fetch_all=True):
    """Execute database query safely using unified adapter"""
    try:
        from db import execute_query as _exec
        return _exec(query, params, fetch_one=fetch_one, fetch_all=fetch_all)
    except Exception:
        return None

class PredictiveHealthAnalytics:
    """Predictive analytics for health metrics"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
    
    def get_predictive_data(self, days=90):
        """Get data for predictive modeling"""
        query = """
        SELECT 
            g.day,
            g.steps,
            g.calories_burned,
            g.resting_heart_rate as rhr,
            g.stress_avg,
            g.moderate_activity_time,
            g.vigorous_activity_time,
            -- Sleep metrics
            s.sleep_score,
            s.sleep_duration_seconds,
            s.deep_sleep_seconds,
            s.light_sleep_seconds,
            s.rem_sleep_seconds,
            -- Journal metrics
            d.mood,
            d.energy_level,
            d.productivity_level,
            d.stress_level_manual,
            d.sleep_quality_manual,
            -- Previous day metrics for lag features
            COALESCE(LAG(g.steps, 1) OVER (ORDER BY g.day), g.steps) as prev_steps,
            COALESCE(LAG(g.resting_heart_rate, 1) OVER (ORDER BY g.day), g.resting_heart_rate) as prev_rhr,
            COALESCE(LAG(s.sleep_score, 1) OVER (ORDER BY g.day), s.sleep_score) as prev_sleep_score,
            COALESCE(LAG(d.mood, 1) OVER (ORDER BY g.day), d.mood) as prev_mood,
            COALESCE(LAG(d.energy_level, 1) OVER (ORDER BY g.day), d.energy_level) as prev_energy,
            -- Moving averages (7-day)
            COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), g.steps) as steps_7day_avg,
            COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), g.resting_heart_rate) as rhr_7day_avg,
            COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), s.sleep_score) as sleep_7day_avg,
            COALESCE(AVG(d.energy_level) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), d.energy_level) as energy_7day_avg,
            COALESCE(AVG(d.mood) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), d.mood) as mood_7day_avg,
            -- Deltas (today - previous)
            (g.steps - COALESCE(LAG(g.steps, 1) OVER (ORDER BY g.day), g.steps)) as steps_delta,
            (g.resting_heart_rate - COALESCE(LAG(g.resting_heart_rate, 1) OVER (ORDER BY g.day), g.resting_heart_rate)) as rhr_delta,
            (s.sleep_score - COALESCE(LAG(s.sleep_score, 1) OVER (ORDER BY g.day), s.sleep_score)) as sleep_delta,
            (g.stress_avg - COALESCE(LAG(g.stress_avg, 1) OVER (ORDER BY g.day), g.stress_avg)) as stress_delta,
            -- Day of week and weekend flag
            EXTRACT(DOW FROM g.day) as day_of_week,
            CASE WHEN EXTRACT(DOW FROM g.day) IN (0,6) THEN 1 ELSE 0 END as is_weekend,
            -- Longer moving averages
            COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 13 PRECEDING AND CURRENT ROW), g.steps) as steps_14day_avg,
            COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 13 PRECEDING AND CURRENT ROW), g.resting_heart_rate) as rhr_14day_avg,
            COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 13 PRECEDING AND CURRENT ROW), s.sleep_score) as sleep_14day_avg,
            COALESCE(AVG(g.stress_avg) OVER (ORDER BY g.day ROWS BETWEEN 13 PRECEDING AND CURRENT ROW), g.stress_avg) as stress_14day_avg,
            COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW), g.steps) as steps_30day_avg,
            COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW), g.resting_heart_rate) as rhr_30day_avg,
            COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW), s.sleep_score) as sleep_30day_avg,
            -- Z-scores over 30 days
            CASE WHEN STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) IS NULL OR STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) = 0
                 THEN 0
                 ELSE (g.steps - AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)) / NULLIF(STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW),0)
            END as steps_z,
            CASE WHEN STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) IS NULL OR STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) = 0
                 THEN 0
                 ELSE (g.resting_heart_rate - AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)) / NULLIF(STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW),0)
            END as rhr_z,
            CASE WHEN STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) IS NULL OR STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) = 0
                 THEN 0
                 ELSE (s.sleep_score - AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)) / NULLIF(STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW),0)
            END as sleep_z,
            -- Behavior flags and seasonality
            CASE WHEN d.meditated IS TRUE THEN 1 ELSE 0 END as meditated_flag,
            EXTRACT(MONTH FROM g.day) as month,
            -- Trend indicators
            ROW_NUMBER() OVER (ORDER BY g.day) as day_number
        FROM garmin_daily_summaries g
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        WHERE g.day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_daily_summaries) - make_interval(days => %s)
        ORDER BY g.day
        """
        
        # Prefer materialized view if exists
        mv = execute_query("SELECT to_regclass('mv_predictive_features') IS NOT NULL AS exists", fetch_one=True)
        if mv and bool(mv.get('exists')):
            query = "SELECT * FROM mv_predictive_features WHERE day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_daily_summaries) - make_interval(days => %s) ORDER BY day"
            return execute_query(query, (days,))
        return execute_query(query, (days,))
    
    def predict_energy_levels(self, days_ahead=7):
        """Predict energy levels based on historical patterns"""
        data = self.get_predictive_data(90)
        if not data or len(data) < 30:
            # Fallback to simple baseline using the target series
            return self._fallback_predict_series(data or [], 'energy_level', days_ahead)
        
        # Prepare features and target
        features = []
        targets = []
        feature_names = [
            'prev_sleep_score', 'prev_steps', 'prev_rhr', 'prev_mood',
            'sleep_7day_avg', 'steps_7day_avg', 'rhr_7day_avg',
            'day_of_week', 'is_weekend', 'month', 'meditated_flag',
            'vigorous_activity_time', 'stress_avg', 'stress_14day_avg',
            'energy_7day_avg', 'mood_7day_avg',
            'steps_delta', 'rhr_delta', 'sleep_delta', 'stress_delta',
            'steps_14day_avg', 'rhr_14day_avg', 'sleep_14day_avg',
            'steps_30day_avg', 'rhr_30day_avg', 'sleep_30day_avg',
            'steps_z', 'rhr_z', 'sleep_z'
        ]
        
        for row in data:
            if row.get('energy_level') is not None:
                feature_row = []
                valid = True
                
                for feature in feature_names:
                    val = row.get(feature)
                    if val is not None:
                        feature_row.append(float(val))
                    else:
                        valid = False
                        break
                
                if valid and len(feature_row) == len(feature_names):
                    features.append(feature_row)
                    targets.append(float(row['energy_level']))
        
        if len(features) < 20:
            return {'error': 'Insufficient valid data points for prediction'}
        
        # Train model
        X = np.array(features)
        y = np.array(targets)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        _X_train_scaled = scaler.fit_transform(X_train)
        _X_test_scaled = scaler.transform(X_test)
        
        # Try load persisted model first
        loaded_model, loaded_scaler = load_model('energy')
        if loaded_model is not None:
            try:
                # Validate loaded model by attempting to generate future predictions.
                # If the loaded artifact is incompatible with the current sklearn version
                # this may raise an exception (seen as missing attributes). In that
                # case delete the artifact and fall through to retraining.
                self.models['energy'] = loaded_model
                self.scalers['energy'] = loaded_scaler
                predictions = self._generate_future_predictions(
                    data, feature_names, 'energy_level', days_ahead, 'random_forest' if isinstance(loaded_model, RandomForestRegressor) else 'linear'
                )
                return {
                    'model_performance': {
                        'r2_score': None,
                        'rmse': None,
                        'model_used': type(loaded_model).__name__.lower()
                    },
                    'predictions': predictions,
                    'feature_importance': self._get_feature_importance(loaded_model, feature_names, 'random_forest' if isinstance(loaded_model, RandomForestRegressor) else 'linear'),
                    'confidence_level': 'unknown'
                }
            except Exception as e:
                # Remove incompatible persisted model to force retraining on next run
                try:
                    model_path('energy').unlink(missing_ok=True)
                except Exception:
                    pass
                # proceed with normal training path

        # Train multiple models and select best
        models = {
            'linear': LinearRegression(),
            'ridge': Ridge(alpha=1.0),
            'random_forest': RandomForestRegressor(n_estimators=50, random_state=42)
        }
        
        # Hyperparameter search with time-series split for Random Forest (robust on small datasets)
        n_train = len(X_train)
        if n_train < 4:
            rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        else:
            n_splits = min(5, max(2, n_train - 1))
            tscv = TimeSeriesSplit(n_splits=n_splits)
            rf_params = {
                'n_estimators': randint(50, 200),
                'max_depth': randint(3, 15),
                'min_samples_split': randint(2, 10),
                'min_samples_leaf': randint(1, 5),
                'max_features': uniform(0.3, 0.7),
            }
            rf_search = RandomizedSearchCV(
                RandomForestRegressor(random_state=42),
                rf_params,
                n_iter=20,
                cv=tscv,
                random_state=42,
                n_jobs=-1,
                scoring='r2',
            )
            rf_search.fit(X_train, y_train)
            rf_model = rf_search.best_estimator_
        models['random_forest'] = rf_model

        best_model = None
        best_score = -float('inf')
        best_model_name = None
        
        for name, model in models.items():
            if name == 'random_forest':
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
            else:
                model.fit(_X_train_scaled, y_train)
                y_pred = model.predict(_X_test_scaled)
            
            score = r2_score(y_test, y_pred)
            if score > best_score:
                best_score = score
                best_model = model
                best_model_name = name
        
        # Persist best model and scaler
        save_model('energy', best_model, scaler)

        # Store model and scaler
        self.models['energy'] = best_model
        self.scalers['energy'] = scaler
        
        # Generate predictions for next days
        predictions = self._generate_future_predictions(
            data, feature_names, 'energy_level', days_ahead, best_model_name
        )
        
        return {
            'model_performance': {
                'r2_score': round(best_score, 3),
                'rmse': round(math.sqrt(mean_squared_error(y_test, y_pred)), 3),
                'model_used': best_model_name
            },
            'predictions': predictions,
            'feature_importance': self._get_feature_importance(best_model, feature_names, best_model_name),
            'confidence_level': self._calculate_confidence_level(best_score)
        }
    
    def predict_sleep_quality(self, days_ahead=7):
        """Predict sleep quality based on daily patterns"""
        data = self.get_predictive_data(90)
        if not data or len(data) < 30:
            # Fallback to simple baseline using the target series
            return self._fallback_predict_series(data or [], 'sleep_score', days_ahead)
        
        # Features for sleep prediction
        features = []
        targets = []
        feature_names = [
            'steps', 'vigorous_activity_time', 'stress_avg', 'stress_14day_avg',
            'prev_sleep_score', 'prev_energy', 'prev_mood',
            'day_of_week', 'is_weekend', 'month', 'meditated_flag',
            'steps_7day_avg', 'energy_7day_avg', 'mood_7day_avg',
            'steps_delta', 'rhr_delta', 'sleep_delta', 'stress_delta',
            'steps_14day_avg', 'rhr_14day_avg', 'sleep_14day_avg',
            'steps_30day_avg', 'rhr_30day_avg', 'sleep_30day_avg',
            'steps_z', 'rhr_z', 'sleep_z'
        ]
        
        for row in data:
            if row.get('sleep_score') is not None:
                feature_row = []
                valid = True
                
                for feature in feature_names:
                    val = row.get(feature)
                    if val is not None:
                        feature_row.append(float(val))
                    else:
                        valid = False
                        break
                
                if valid and len(feature_row) == len(feature_names):
                    features.append(feature_row)
                    targets.append(float(row['sleep_score']))
        
        if len(features) < 20:
            return {'error': 'Insufficient valid data points for prediction'}
        
        # Train model (similar process as energy prediction)
        X = np.array(features)
        y = np.array(targets)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        scaler = StandardScaler()
        _X_train_scaled = scaler.fit_transform(X_train)
        _X_test_scaled = scaler.transform(X_test)
        
        # Try load persisted model first
        loaded_model, loaded_scaler = load_model('sleep')
        if loaded_model is not None:
            try:
                self.models['sleep'] = loaded_model
                self.scalers['sleep'] = loaded_scaler
                predictions = self._generate_future_predictions(
                    data, feature_names, 'sleep_score', days_ahead, 'random_forest'
                )
                return {
                    'model_performance': {
                        'r2_score': None,
                        'rmse': None,
                        'model_used': type(loaded_model).__name__.lower()
                    },
                    'predictions': predictions,
                    'feature_importance': self._get_feature_importance(loaded_model, feature_names, 'random_forest'),
                    'confidence_level': 'unknown'
                }
            except Exception:
                try:
                    model_path('sleep').unlink(missing_ok=True)
                except Exception:
                    pass
                # Fall through to retraining

        # Tune Random Forest with time-series CV (robust for small datasets)
        n_train = len(X_train)
        if n_train < 4:
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
        else:
            n_splits = min(5, max(2, n_train - 1))
            tscv = TimeSeriesSplit(n_splits=n_splits)
            rf_params = {
                'n_estimators': randint(50, 200),
                'max_depth': randint(3, 15),
                'min_samples_split': randint(2, 10),
                'min_samples_leaf': randint(1, 5),
                'max_features': uniform(0.3, 0.7),
            }
            rf_search = RandomizedSearchCV(
                RandomForestRegressor(random_state=42),
                rf_params,
                n_iter=20,
                cv=tscv,
                random_state=42,
                n_jobs=-1,
                scoring='r2',
            )
            rf_search.fit(X_train, y_train)
            model = rf_search.best_estimator_
        y_pred = model.predict(X_test)
        
        score = r2_score(y_test, y_pred)
        
        # Persist
        save_model('sleep', model, scaler)
        self.models['sleep'] = model
        self.scalers['sleep'] = scaler
        
        predictions = self._generate_future_predictions(
            data, feature_names, 'sleep_score', days_ahead, 'random_forest'
        )
        
        return {
            'model_performance': {
                'r2_score': round(score, 3),
                'rmse': round(math.sqrt(mean_squared_error(y_test, y_pred)), 3),
                'model_used': 'random_forest'
            },
            'predictions': predictions,
            'feature_importance': self._get_feature_importance(model, feature_names, 'random_forest'),
            'confidence_level': self._calculate_confidence_level(score)
        }
    
    def predict_mood_trends(self, days_ahead=7):
        """Predict mood trends"""
        data = self.get_predictive_data(90)
        if not data or len(data) < 30:
            # Fallback to simple baseline using the target series
            return self._fallback_predict_series(data or [], 'mood', days_ahead)
        
        features = []
        targets = []
        feature_names = [
            'prev_sleep_score', 'prev_energy', 'prev_mood', 'steps', 'rhr',
            'stress_avg', 'stress_14day_avg',
            'day_of_week', 'is_weekend', 'month', 'meditated_flag',
            'sleep_7day_avg', 'steps_7day_avg', 'energy_7day_avg', 'mood_7day_avg',
            'steps_delta', 'rhr_delta', 'sleep_delta', 'stress_delta',
            'steps_14day_avg', 'rhr_14day_avg', 'sleep_14day_avg',
            'steps_30day_avg', 'rhr_30day_avg', 'sleep_30day_avg',
            'steps_z', 'rhr_z', 'sleep_z'
        ]
        
        for row in data:
            if row.get('mood') is not None:
                feature_row = []
                valid = True
                
                for feature in feature_names:
                    val = row.get(feature)
                    if val is not None:
                        feature_row.append(float(val))
                    else:
                        valid = False
                        break
                
                if valid and len(feature_row) == len(feature_names):
                    features.append(feature_row)
                    targets.append(float(row['mood']))
        
        if len(features) < 20:
            return {'error': 'Insufficient valid data points for prediction'}
        
        X = np.array(features)
        y = np.array(targets)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Tune Random Forest with time-series CV (or load persisted) - robust for small datasets
        loaded_model, _ = load_model('mood')
        if loaded_model is not None:
            try:
                model = loaded_model
            except Exception:
                try:
                    model_path('mood').unlink(missing_ok=True)
                except Exception:
                    pass
                model = None
        else:
            n_train = len(X_train)
            if n_train < 4:
                model = RandomForestRegressor(n_estimators=100, random_state=42)
                model.fit(X_train, y_train)
            else:
                n_splits = min(5, max(2, n_train - 1))
                tscv = TimeSeriesSplit(n_splits=n_splits)
                rf_params = {
                    'n_estimators': randint(50, 200),
                    'max_depth': randint(3, 15),
                    'min_samples_split': randint(2, 10),
                    'min_samples_leaf': randint(1, 5),
                    'max_features': uniform(0.3, 0.7),
                }
                rf_search = RandomizedSearchCV(
                    RandomForestRegressor(random_state=42),
                    rf_params,
                    n_iter=20,
                    cv=tscv,
                    random_state=42,
                    n_jobs=-1,
                    scoring='r2',
                )
                rf_search.fit(X_train, y_train)
                model = rf_search.best_estimator_
        y_pred = model.predict(X_test)
        
        score = r2_score(y_test, y_pred)
        
        # Store & persist model for mood (no scaler)
        save_model('mood', model, None)
        self.models['mood'] = model
        self.scalers['mood'] = None

        predictions = self._generate_future_predictions(
            data, feature_names, 'mood', days_ahead, 'random_forest'
        )
        
        return {
            'model_performance': {
                'r2_score': round(score, 3),
                'rmse': round(math.sqrt(mean_squared_error(y_test, y_pred)), 3)
            },
            'predictions': predictions,
            'feature_importance': self._get_feature_importance(model, feature_names, 'random_forest'),
            'confidence_level': self._calculate_confidence_level(score)
        }
    
    def _generate_future_predictions(self, data, feature_names, target, days_ahead, model_type):
        """Generate predictions for future days"""
        if not data:
            return []
        
        model = self.models.get(target.split('_')[0])
        scaler = self.scalers.get(target.split('_')[0])
        
        if not model:
            return []
        
        predictions = []
        last_row = data[-1]
        
        for i in range(days_ahead):
            future_date = last_row['day'] + timedelta(days=i+1) if last_row.get('day') else None
            
            # Create feature vector for prediction
            feature_vector = []
            for feature in feature_names:
                if feature == 'day_of_week':
                    # Calculate day of week for future date
                    if future_date:
                        dow = future_date.weekday()
                        feature_vector.append(float(dow))
                    else:
                        feature_vector.append(0.0)
                elif feature.startswith('prev_'):
                    # Use last known values or predictions
                    base_feature = feature.replace('prev_', '')
                    if i == 0:
                        val = last_row.get(base_feature, 0)
                    else:
                        # Use previous prediction if available
                        val = predictions[-1]['predicted_value'] if predictions else last_row.get(base_feature, 0)
                    feature_vector.append(float(val) if val is not None else 0.0)
                else:
                    # Use recent average or last known value
                    val = last_row.get(feature, 0)
                    feature_vector.append(float(val) if val is not None else 0.0)
            
            # Make prediction
            if model_type == 'random_forest':
                prediction = model.predict([feature_vector])[0]
            else:
                if scaler:
                    scaled_features = scaler.transform([feature_vector])
                    prediction = model.predict(scaled_features)[0]
                else:
                    prediction = model.predict([feature_vector])[0]

            # Clamp prediction to valid target range
            if target in ('energy_level', 'mood'):
                prediction = max(1.0, min(5.0, float(prediction)))
            elif target == 'sleep_score':
                prediction = max(0.0, min(100.0, float(prediction)))
            
            predictions.append({
                'date': future_date.isoformat() if future_date else f"Day +{i+1}",
                'predicted_value': round(prediction, 2),
                'confidence': self._calculate_prediction_confidence(i, days_ahead)
            })
        
        return predictions
    
    def _get_feature_importance(self, model, feature_names, model_type):
        """Get feature importance from model"""
        if model_type == 'random_forest' and hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            return [
                {'feature': name, 'importance': round(imp, 3)}
                for name, imp in zip(feature_names, importances)
            ]
        elif hasattr(model, 'coef_'):
            # For linear models, use absolute coefficients
            coefficients = np.abs(model.coef_)
            return [
                {'feature': name, 'importance': round(coef, 3)}
                for name, coef in zip(feature_names, coefficients)
            ]
        
        return []
    
    def _calculate_confidence_level(self, r2_score):
        """Calculate confidence level based on model performance"""
        if r2_score >= 0.8:
            return 'high'
        elif r2_score >= 0.6:
            return 'medium'
        elif r2_score >= 0.4:
            return 'low'
        else:
            return 'very_low'
    
    def _calculate_prediction_confidence(self, day_index, total_days):
        """Calculate confidence for individual predictions (decreases with time)"""
        confidence = max(0.5, 1.0 - (day_index / total_days) * 0.5)
        return round(confidence, 2)

    def _fallback_predict_series(self, data, target, days_ahead):
        """Generate simple baseline predictions using the target series only.
        - Uses last up to 14 points of the target series
        - Fits a simple linear regression for trend; if too few points, uses mean
        - Returns dict matching standard output shape for predict_* methods
        """
        # Extract (date, value) pairs for the target
        series = [(row.get('day'), row.get(target)) for row in data if row.get(target) is not None]
        if not series:
            return {
                'model_performance': None,
                'predictions': [],
                'feature_importance': [],
                'confidence_level': 'very_low',
            }
        # Use last up to 14 values
        series = series[-14:]
        y = np.array([float(v) for _, v in series])
        n = len(y)
        use_trend = n >= 3
        if use_trend:
            X = np.arange(n).reshape(-1, 1)
            lin = LinearRegression()
            lin.fit(X, y)
            slope = float(lin.coef_[0])
            intercept = float(lin.intercept_)
        else:
            slope = 0.0
            intercept = float(np.mean(y))
        # Start date from last known day
        last_day = series[-1][0]
        preds = []
        for i in range(days_ahead):
            t = n + i  # next index
            pred = intercept + slope * t
            # Clamp to valid ranges
            if target in ('energy_level', 'mood'):
                pred = max(1.0, min(5.0, float(pred)))
            elif target == 'sleep_score':
                pred = max(0.0, min(100.0, float(pred)))
            # Compute future date
            future_date = (last_day + timedelta(days=i+1)) if last_day else None
            preds.append({
                'date': future_date.isoformat() if future_date else f"Day +{i+1}",
                'predicted_value': round(float(pred), 2),
                'confidence': self._calculate_prediction_confidence(i, days_ahead),
            })
        return {
            'model_performance': None,
            'predictions': preds,
            'feature_importance': [],
            'confidence_level': 'very_low',
        }
    
    def analyze_health_trends(self, days=90):
        """Analyze overall health trends"""
        data = self.get_predictive_data(days)
        if not data:
            return {'error': 'No data available'}
        
        trends = {}
        metrics = ['steps', 'rhr', 'sleep_score', 'mood', 'energy_level', 'stress_avg']
        
        for metric in metrics:
            values = []
            dates = []
            
            for row in data:
                if row.get(metric) is not None and row.get('day'):
                    values.append(float(row[metric]))
                    dates.append(row['day'])
            
            if len(values) >= 10:
                # Calculate trend using linear regression
                X = np.array(range(len(values))).reshape(-1, 1)
                y = np.array(values)
                
                model = LinearRegression()
                model.fit(X, y)
                
                slope = model.coef_[0]
                trend_direction = 'improving' if slope > 0 else 'declining' if slope < 0 else 'stable'
                
                # Calculate trend strength
                r2 = model.score(X, y)
                trend_strength = 'strong' if r2 > 0.7 else 'moderate' if r2 > 0.4 else 'weak'
                
                trends[metric] = {
                    'direction': trend_direction,
                    'strength': trend_strength,
                    'slope': round(slope, 4),
                    'r2_score': round(r2, 3),
                    'current_value': round(values[-1], 2),
                    'period_change': round(values[-1] - values[0], 2),
                    'data_points': len(values)
                }
        
        return {
            'analysis_period_days': days,
            'trends': trends,
            'overall_health_direction': self._assess_overall_health_direction(trends)
        }
    
    def _assess_overall_health_direction(self, trends):
        """Assess overall health direction from individual trends"""
        positive_metrics = ['steps', 'sleep_score', 'mood', 'energy_level']
        negative_metrics = ['rhr', 'stress_avg']
        
        improvement_score = 0
        total_metrics = 0
        
        for metric, trend_data in trends.items():
            if trend_data['strength'] in ['strong', 'moderate']:
                total_metrics += 1
                
                if metric in positive_metrics and trend_data['direction'] == 'improving':
                    improvement_score += 1
                elif metric in negative_metrics and trend_data['direction'] == 'declining':
                    improvement_score += 1
        
        if total_metrics == 0:
            return 'insufficient_data'
        
        improvement_ratio = improvement_score / total_metrics
        
        if improvement_ratio >= 0.7:
            return 'improving'
        elif improvement_ratio >= 0.4:
            return 'mixed'
        else:
            return 'declining'
    
    def get_comprehensive_predictions(self, days_ahead=7):
        """Get comprehensive predictions for all metrics"""
        results = {
            'prediction_period_days': days_ahead,
            'energy_predictions': self.predict_energy_levels(days_ahead),
            'sleep_predictions': self.predict_sleep_quality(days_ahead),
            'mood_predictions': self.predict_mood_trends(days_ahead),
            'health_trends': self.analyze_health_trends(),
            'recommendations': []
        }
        
        # Generate recommendations based on predictions
        results['recommendations'] = self._generate_predictive_recommendations(results)
        
        return results
    
    def _generate_predictive_recommendations(self, predictions):
        """Generate recommendations based on predictions"""
        recommendations = []
        
        # Energy predictions
        energy_pred = predictions.get('energy_predictions', {})
        if energy_pred.get('predictions'):
            avg_predicted_energy = mean([p['predicted_value'] for p in energy_pred['predictions']])
            if avg_predicted_energy < 3.5:
                recommendations.append("Predicted low energy levels - focus on sleep quality and stress management")
        
        # Sleep predictions
        sleep_pred = predictions.get('sleep_predictions', {})
        if sleep_pred.get('predictions'):
            avg_predicted_sleep = mean([p['predicted_value'] for p in sleep_pred['predictions']])
            if avg_predicted_sleep < 75:
                recommendations.append("Sleep quality may decline - maintain consistent bedtime routine")
        
        # Health trends
        trends = predictions.get('health_trends', {})
        if trends.get('overall_health_direction') == 'declining':
            recommendations.append("Overall health trends declining - consider lifestyle adjustments")
        elif trends.get('overall_health_direction') == 'improving':
            recommendations.append("Health trends are positive - maintain current habits")
        
        return recommendations

def main():
    """Test predictive analytics"""
    print("🔮 Testing predictive analytics...")
    
    predictor = PredictiveHealthAnalytics()
    
    print("\n📊 Generating comprehensive predictions...")
    results = predictor.get_comprehensive_predictions(7)
    
    print(f"✅ Energy prediction confidence: {results.get('energy_predictions', {}).get('confidence_level', 'N/A')}")
    print(f"✅ Sleep prediction confidence: {results.get('sleep_predictions', {}).get('confidence_level', 'N/A')}")
    print(f"✅ Health trend direction: {results.get('health_trends', {}).get('overall_health_direction', 'N/A')}")
    print(f"✅ Recommendations generated: {len(results.get('recommendations', []))}")
    
    print("\n🔮 Predictive analytics testing completed")

if __name__ == '__main__':
    main()