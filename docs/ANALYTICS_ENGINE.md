# ANALYTICS ENGINE

Deep dive into enhanced + specialized analytics components.

## Module Overview
| Module | Purpose |
|--------|---------|
| `enhanced_analytics_engine.py` | Multi-domain aggregation + ML/stat analysis |
| `specialized_analytics.py` | Sleep / Stress / Activity domain modules |
| `predictive_analytics.py` | Short horizon forecasting models |
| `recovery_pattern` logic (inside enhanced + recovery modules) | Trend & pattern scoring |

## Data Inputs
The enhanced engine draws from consolidated health views (journal + Garmin daily summaries + sleep sessions + derived metrics).

Minimum recommended data:
- ≥30 days for correlations & temporal patterns
- ≥60–90 days for stable clustering
- ≥20 observations for basic predictive models

## Feature Categories
| Category | Examples |
|----------|----------|
| Activity | steps, calories_total, intensity estimates |
| Sleep | sleep_score, time_in_bed_minutes, efficiency proxies |
| Stress / Recovery | stress_avg, resting_heart_rate (RHR), recovery trend scores |
| Subjective | mood, energy_level, notes-derived flags |
| Journal Supplements | ashwagandha, magnesium, vitamin_d flags |

## Enhanced Analytics Capabilities
1. Correlation Matrix (Pearson / Spearman / rank-based)
2. Cluster Analysis (k-means) → cluster metadata & interpretation scaffolding
3. Temporal Patterns → day-of-week aggregation + week trend slope
4. Recovery Patterns → composite scoring + trend series
5. Period Comparisons → averaging metrics & deltas across arbitrary windows

## Key Methods (Conceptual)
```python
engine.get_comprehensive_insights(days=90)
engine.get_comprehensive_health_data_v2(days)
engine.calculate_advanced_correlations(data)
engine.perform_cluster_analysis(data, n_clusters=3)
engine.analyze_temporal_patterns(data)
engine.analyze_recovery_patterns(data)
```

## Recovery Analysis
Outputs:
- trend_series: chronological composite recovery metric
- pattern_details: domain decomposition (sleep quality, stress load, activity balance)
- comparative mode: optional previous window overlay if `compare=true`

## Clustering
- Standard scaling → k-means
- Dynamic cluster labeling based on relative metric z-scores
- Recommend testing 3–5 clusters first; >8 rarely stable on small personal datasets

## Correlations
- Filters out fields with insufficient variance
- Combines significance indicators (p-values) & effect size heuristics
- Produces top insights list (human-readable strings) for UI / reporting

## Temporal Patterns
- Day-of-week means & variance
- Week-level slope for key metrics (e.g. monotonic improvement/decline)
- Optional seasonality hook (extendable)

## Predictive Models
Approach: very lightweight to avoid overfitting on small personal datasets.
- Regression (linear/ridge) for trend + baseline
- Random forest (where sample size allows) for non-linear effects
- Feature importance normalized → driver ranking

## Period Comparison
Query params: `period1_days`, `period2_days`, `offset_days`.
Outputs average metrics + deltas (period1 - period2). Useful for habit change experiments.

## API Alignment
| Capability | Endpoint |
|------------|----------|
| Correlations | `/api/analytics/enhanced/correlations` |
| Clusters | `/api/analytics/enhanced/clusters` |
| Temporal | `/api/analytics/enhanced/temporal-patterns` |
| Recovery | `/api/analytics/enhanced/recovery` |
| Comprehensive | `/api/analytics/enhanced/comprehensive` |
| Period Compare | `/api/analytics/compare/periods` |

## Interpreting Outputs
| Field | Meaning |
|-------|---------|
| `significant_correlations` | Filtered list of statistically meaningful links |
| `clusters.cluster_X.characteristics` | Means & std dev per metric within a cluster |
| `patterns.day_of_week` | Aggregated metrics keyed by weekday |
| `recovery_analysis.trend_series` | Time series for recovery composite index |
| `feature_importance` | Relative contribution in predictive models |

## Performance Notes
- Correlation & cluster complexity scale with number of metrics × observations (small for personal use)
- Cache layer (future enhancement) could persist last N computations
- Numeric cleaning: conversion of Decimals to float before JSON serialization

## Extending
1. Add metric: ensure migrations and ingestion push it into comprehensive dataset
2. Add model: wrap in predictive module with consistent interface (`predict_<metric>`)
3. Add new analysis: create method on enhanced engine + route in `analytics.py`

## Pitfalls / Edge Cases
| Issue | Handling |
|-------|----------|
| Sparse data (<10 rows) | Returns empty structures or 404 style error via helper |
| Zero variance metric | Excluded from correlation & clustering automatically |
| Insufficient clusters | Falls back / raises validation error |
| Date gaps | Left as-is; trend calcs work on existing days only |

## Roadmap Ideas
- Rolling window caching
- Anomaly detection (Z-score & seasonal decomposition)
- Sleep stage influence modeling
- Multi-metric optimization suggestions (Pareto frontier)

---
Refine further? Open an issue or drop a note.
