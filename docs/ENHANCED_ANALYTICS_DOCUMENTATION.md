# 🧠 Enhanced Analytics Documentation

## Overview

The enhanced analytics system provides sophisticated health data analysis capabilities including machine learning insights, predictive analytics, and specialized domain analysis for sleep, stress, and activity patterns.

## 📊 Analytics Modules

### 1. Enhanced Analytics Engine (`enhanced_analytics_engine.py`)

Advanced analytics with machine learning capabilities:

#### Features:
- **Advanced Correlations**: Pearson, Spearman, and Kendall correlations
- **Cluster Analysis**: K-means clustering to identify health patterns
- **Temporal Pattern Analysis**: Day-of-week and weekly trend analysis
- **Recovery Pattern Analysis**: Comprehensive recovery scoring
- **Statistical Significance Testing**: P-values and confidence intervals

#### Key Methods:
```python
# Get comprehensive insights
insights = enhanced_analytics.get_comprehensive_insights(days=90)

# Calculate advanced correlations
correlations = enhanced_analytics.calculate_advanced_correlations(data)

# Perform cluster analysis
clusters = enhanced_analytics.perform_cluster_analysis(data, n_clusters=3)

# Analyze temporal patterns
patterns = enhanced_analytics.analyze_temporal_patterns(data)

# Analyze recovery patterns
recovery = enhanced_analytics.analyze_recovery_patterns(data)
```

### 2. Specialized Analytics (`specialized_analytics.py`)

Domain-specific analysis modules:

#### Sleep Analytics
- **Sleep Efficiency Analysis**: Sleep quality vs. recovery correlation
- **Sleep Timing Analysis**: Bedtime and wake time consistency
- **Sleep Impact Analysis**: How sleep affects next-day performance
- **Sleep Recommendations**: Personalized sleep optimization tips

#### Stress Analytics
- **Hourly Stress Patterns**: Stress levels throughout the day
- **Daily Stress Patterns**: Day-of-week stress variations
- **Stress Trigger Identification**: Detection of high-stress episodes
- **Stress Recovery Analysis**: How quickly stress levels normalize

#### Activity Analytics
- **Activity Intensity Analysis**: High/moderate/low activity classification
- **Activity vs. Recovery Correlation**: Impact on next-day metrics
- **Activity Consistency**: Weekly and daily pattern analysis
- **Sport-Specific Analysis**: Performance metrics by activity type

### 3. Predictive Analytics (`predictive_analytics.py`)

Machine learning-based forecasting:

#### Prediction Capabilities:
- **Energy Level Predictions**: 7-day energy forecasts
- **Sleep Quality Predictions**: Sleep score forecasting
- **Mood Trend Predictions**: Mood pattern forecasting
- **Health Trend Analysis**: Overall health direction assessment

#### Machine Learning Models:
- **Linear Regression**: For trend analysis
- **Ridge Regression**: For regularized predictions
- **Random Forest**: For complex pattern recognition
- **Feature Importance Analysis**: Key factors identification

## 🌐 API Endpoints

### Enhanced Analytics Endpoints

#### Comprehensive Analytics
```
GET /api/analytics/enhanced/comprehensive?days=90
```
Returns complete enhanced analytics including correlations, clusters, and patterns.

#### Advanced Correlations
```
GET /api/analytics/enhanced/correlations?days=90
```
Returns Pearson, Spearman, and Kendall correlations with significance testing.

#### Cluster Analysis
```
GET /api/analytics/enhanced/clusters?days=90&clusters=3
```
Returns health pattern clusters with interpretations.

#### Temporal Patterns
```
GET /api/analytics/enhanced/temporal-patterns?days=90
```
Returns day-of-week and weekly trend analysis.

#### Recovery Analysis
```
GET /api/analytics/enhanced/recovery?days=90
```
Returns comprehensive recovery pattern analysis.

### Specialized Analytics Endpoints

#### Sleep Analysis
```
GET /api/analytics/sleep/comprehensive?days=30
```
Returns comprehensive sleep efficiency and quality analysis.

#### Stress Analysis
```
GET /api/analytics/stress/comprehensive?days=30
```
Returns stress pattern analysis with trigger identification.

#### Activity Analysis
```
GET /api/analytics/activity/comprehensive?days=30
```
Returns activity pattern and recovery correlation analysis.

### Predictive Analytics Endpoints

#### Energy Predictions
```
GET /api/predictions/energy?days_ahead=7
```
Returns 7-day energy level predictions with confidence intervals.

#### Sleep Predictions
```
GET /api/predictions/sleep?days_ahead=7
```
Returns sleep quality forecasts.

#### Mood Predictions
```
GET /api/predictions/mood?days_ahead=7
```
Returns mood trend predictions.

#### Comprehensive Predictions
```
GET /api/predictions/comprehensive?days_ahead=7
```
Returns all prediction types with recommendations.

#### Health Trends
```
GET /api/trends/health?days=90
```
Returns overall health trend analysis with direction assessment.

### Advanced Insights Endpoints

#### Personalized Insights
```
GET /api/insights/personalized?days=90
```
Returns personalized health insights combining all analytics modules.

#### Optimization Insights
```
GET /api/insights/optimization?days=60&metric=energy_level
```
Returns optimization recommendations for specific health metrics.

#### Period Comparisons
```
GET /api/analytics/compare/periods?period1_days=30&period2_days=30&offset_days=30
```
Compares health metrics between different time periods.

## 📈 Response Examples

### Enhanced Correlations Response
```json
{
  "status": "success",
  "analysis_type": "enhanced_correlations",
  "period_days": 90,
  "data_points": 85,
  "correlations": {
    "pearson": {
      "sleep_score": {
        "energy_level": 0.742,
        "mood": 0.658
      }
    },
    "spearman": {
      "sleep_score": {
        "energy_level": 0.721,
        "mood": 0.634
      }
    },
    "significant_correlations": [
      {
        "field1": "sleep_score",
        "field2": "energy_level",
        "correlation": 0.742,
        "p_value": 0.0001,
        "strength": "strong",
        "type": "pearson"
      }
    ],
    "insights": [
      "Sleep quality has a strong positive correlation with next-day energy levels",
      "Daily activity shows a moderate positive relationship with mood"
    ]
  }
}
```

### Cluster Analysis Response
```json
{
  "status": "success",
  "analysis_type": "cluster_analysis",
  "clusters": {
    "cluster_0": {
      "size": 28,
      "percentage": 32.9,
      "characteristics": {
        "steps": {"mean": 12450, "std": 2100},
        "sleep_score": {"mean": 82, "std": 8},
        "mood": {"mean": 4.2, "std": 0.6}
      },
      "interpretation": ["High activity days", "Excellent sleep quality", "High wellbeing days"]
    }
  }
}
```

### Predictive Analytics Response
```json
{
  "status": "success",
  "prediction_type": "energy_levels",
  "days_ahead": 7,
  "predictions": {
    "model_performance": {
      "r2_score": 0.742,
      "rmse": 0.68,
      "model_used": "random_forest"
    },
    "predictions": [
      {
        "date": "2024-01-15",
        "predicted_value": 4.2,
        "confidence": 0.85
      }
    ],
    "feature_importance": [
      {"feature": "prev_sleep_score", "importance": 0.342},
      {"feature": "prev_steps", "importance": 0.218}
    ],
    "confidence_level": "high"
  }
}
```

## 🔧 Configuration

### Dependencies
```bash
pip install numpy scipy scikit-learn pandas
```

### Environment Variables
```bash
# Database configuration (same as existing)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=diary
DB_USER=diary_user
DB_PASSWORD=diary123
```

## 🚀 Usage Examples

### Python Usage
```python
from analytics.enhanced_analytics_engine import EnhancedHealthAnalytics  # now under Diary-AI-BE/scripts/analytics/
from analytics.specialized_analytics import SleepAnalytics, StressAnalytics
from analytics.predictive_analytics import PredictiveHealthAnalytics

# Initialize analytics engines
enhanced = EnhancedHealthAnalytics()
sleep = SleepAnalytics()
predictive = PredictiveHealthAnalytics()

# Get comprehensive insights
insights = enhanced.get_comprehensive_insights(90)

# Get sleep analysis
sleep_analysis = sleep.analyze_sleep_efficiency(30)

# Get predictions
energy_predictions = predictive.predict_energy_levels(7)
```

### API Usage
```bash
# Get comprehensive analytics
curl "http://localhost:5002/api/analytics/enhanced/comprehensive?days=90"

# Get sleep analysis
curl "http://localhost:5002/api/analytics/sleep/comprehensive?days=30"

# Get energy predictions
curl "http://localhost:5002/api/predictions/energy?days_ahead=7"

# Get personalized insights
curl "http://localhost:5002/api/insights/personalized?days=90"
```

## 📊 Analytics Capabilities Summary

### Correlation Analysis
- **Pearson**: Linear relationships
- **Spearman**: Monotonic relationships
- **Kendall**: Rank-based correlations
- **Significance Testing**: P-values and confidence intervals

### Machine Learning
- **Clustering**: Health pattern identification
- **Regression**: Trend analysis and prediction
- **Feature Importance**: Key factor identification
- **Model Validation**: R² scores and RMSE

### Specialized Domains
- **Sleep**: Efficiency, timing, impact analysis
- **Stress**: Patterns, triggers, recovery
- **Activity**: Intensity, consistency, recovery correlation

### Predictive Capabilities
- **Energy Forecasting**: 7-day predictions
- **Sleep Quality Forecasting**: Quality score predictions
- **Mood Trend Analysis**: Mood pattern forecasting
- **Health Trend Assessment**: Overall direction analysis

### Insights Generation
- **Personalized Recommendations**: Based on individual patterns
- **Optimization Suggestions**: Metric-specific improvements
- **Pattern Recognition**: Automated insight generation
- **Comparative Analysis**: Time period comparisons

## 🔍 Key Insights Provided

1. **Health Pattern Identification**: Automatic detection of health behavior clusters
2. **Predictive Warnings**: Early indicators of declining health metrics
3. **Optimization Opportunities**: Data-driven improvement suggestions
4. **Correlation Discovery**: Hidden relationships between health metrics
5. **Temporal Insights**: Day-of-week and seasonal patterns
6. **Recovery Optimization**: Personalized recovery recommendations
7. **Stress Management**: Trigger identification and management strategies
8. **Sleep Optimization**: Evidence-based sleep improvement suggestions

## 🎯 Benefits

- **Proactive Health Management**: Predict and prevent health issues
- **Personalized Insights**: Tailored recommendations based on individual data
- **Evidence-Based Decisions**: Data-driven health optimization
- **Pattern Recognition**: Discover hidden health relationships
- **Trend Monitoring**: Track long-term health trajectory
- **Comprehensive Analysis**: Multi-domain health assessment

## 🔧 Technical Notes

### Performance Considerations
- Minimum 30 data points recommended for reliable analysis
- Cluster analysis requires at least 10 data points
- Predictive models need 20+ data points for training
- Real-time analysis optimized for 90-day windows

### Data Quality Requirements
- Missing data handling with interpolation
- Outlier detection and treatment
- Data validation and cleaning
- Temporal alignment of metrics

### Scalability
- Efficient database queries with proper indexing
- Caching of computed analytics results
- Incremental model updates
- Parallel processing for large datasets