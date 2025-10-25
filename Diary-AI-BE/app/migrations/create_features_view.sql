-- Materialized view for predictive features
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_predictive_features AS
SELECT 
  g.day,
  g.steps,
  g.calories_burned,
  g.resting_heart_rate as rhr,
  g.stress_avg,
  g.moderate_activity_time,
  g.vigorous_activity_time,
  s.sleep_score,
  s.sleep_duration_seconds,
  s.deep_sleep_seconds,
  s.light_sleep_seconds,
  s.rem_sleep_seconds,
  d.mood,
  d.energy_level,
  d.productivity_level,
  d.stress_level_manual,
  d.sleep_quality_manual,
  COALESCE(LAG(g.steps, 1) OVER (ORDER BY g.day), g.steps) as prev_steps,
  COALESCE(LAG(g.resting_heart_rate, 1) OVER (ORDER BY g.day), g.resting_heart_rate) as prev_rhr,
  COALESCE(LAG(s.sleep_score, 1) OVER (ORDER BY g.day), s.sleep_score) as prev_sleep_score,
  COALESCE(LAG(d.mood, 1) OVER (ORDER BY g.day), d.mood) as prev_mood,
  COALESCE(LAG(d.energy_level, 1) OVER (ORDER BY g.day), d.energy_level) as prev_energy,
  COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), g.steps) as steps_7day_avg,
  COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), g.resting_heart_rate) as rhr_7day_avg,
  COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), s.sleep_score) as sleep_7day_avg,
  COALESCE(AVG(d.energy_level) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), d.energy_level) as energy_7day_avg,
  COALESCE(AVG(d.mood) OVER (ORDER BY g.day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING), d.mood) as mood_7day_avg,
  (g.steps - COALESCE(LAG(g.steps, 1) OVER (ORDER BY g.day), g.steps)) as steps_delta,
  (g.resting_heart_rate - COALESCE(LAG(g.resting_heart_rate, 1) OVER (ORDER BY g.day), g.resting_heart_rate)) as rhr_delta,
  (s.sleep_score - COALESCE(LAG(s.sleep_score, 1) OVER (ORDER BY g.day), s.sleep_score)) as sleep_delta,
  (g.stress_avg - COALESCE(LAG(g.stress_avg, 1) OVER (ORDER BY g.day), g.stress_avg)) as stress_delta,
  EXTRACT(DOW FROM g.day) as day_of_week,
  CASE WHEN EXTRACT(DOW FROM g.day) IN (0,6) THEN 1 ELSE 0 END as is_weekend,
  COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING), g.steps) as steps_14day_avg,
  COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING), g.resting_heart_rate) as rhr_14day_avg,
  COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING), s.sleep_score) as sleep_14day_avg,
  COALESCE(AVG(g.stress_avg) OVER (ORDER BY g.day ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING), g.stress_avg) as stress_14day_avg,
  COALESCE(AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING), g.steps) as steps_30day_avg,
  COALESCE(AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING), g.resting_heart_rate) as rhr_30day_avg,
  COALESCE(AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING), s.sleep_score) as sleep_30day_avg,
  CASE WHEN STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) IS NULL OR STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) = 0
       THEN 0
       ELSE (g.steps - AVG(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)) / NULLIF(STDDEV_SAMP(g.steps) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING),0)
  END as steps_z,
  CASE WHEN STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) IS NULL OR STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) = 0
       THEN 0
       ELSE (g.resting_heart_rate - AVG(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)) / NULLIF(STDDEV_SAMP(g.resting_heart_rate) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING),0)
  END as rhr_z,
  CASE WHEN STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) IS NULL OR STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) = 0
       THEN 0
       ELSE (s.sleep_score - AVG(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)) / NULLIF(STDDEV_SAMP(s.sleep_score) OVER (ORDER BY g.day ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING),0)
  END as sleep_z,
  CASE WHEN d.meditated IS TRUE THEN 1 ELSE 0 END as meditated_flag,
  EXTRACT(MONTH FROM g.day) as month
FROM garmin_daily_summaries g
LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
LEFT JOIN daily_journal d ON g.day = d.day
WITH NO DATA;

-- Refresh command
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_predictive_features;