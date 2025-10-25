-- Optional SQL migration to ensure helpful indexes exist for analytics
-- Run this manually or via a migration tool as needed.

CREATE INDEX IF NOT EXISTS idx_gds_day ON garmin_daily_summaries(day);
CREATE INDEX IF NOT EXISTS idx_gss_day ON garmin_sleep_sessions(day);
CREATE INDEX IF NOT EXISTS idx_gha_day ON garmin_heart_rate_data(day);
CREATE INDEX IF NOT EXISTS idx_gsd_day ON garmin_stress_data(day);
CREATE INDEX IF NOT EXISTS idx_ga_sport_day ON garmin_activities(LOWER(sport), COALESCE(day, start_time::date));
