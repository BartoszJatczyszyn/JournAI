-- Migration: Tie strength logs to garmin_activities and prepare deprecation of workout_sessions
-- Date: 2025-10-25

-- 1) Add link from exercise_logs to garmin_activities
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS garmin_activity_id BIGINT NULL REFERENCES garmin_activities(activity_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ex_logs_garmin ON exercise_logs(garmin_activity_id);

-- 2) New activity-based session metrics view
CREATE OR REPLACE VIEW v_strength_activity_metrics AS
SELECT
  ga.activity_id AS garmin_activity_id,
  COALESCE(SUM(m.total_volume), 0) AS total_activity_volume
FROM garmin_activities ga
LEFT JOIN exercise_logs el ON el.garmin_activity_id = ga.activity_id
LEFT JOIN v_exercise_log_metrics m ON m.exercise_log_id = el.id
GROUP BY ga.activity_id;

-- Notes:
-- - Keep workout_sessions and v_workout_session_metrics during transition; code can switch to garmin-based reads.
-- - Backfill strategy (optional): if existing workout_sessions should be mapped to garmin_activities,
--   create an ETL job to join by (user_id, started_at::date ~= start_time::date) and set exercise_logs.garmin_activity_id accordingly.
-- - After backfill and app switch, workout_sessions table can be dropped safely.
