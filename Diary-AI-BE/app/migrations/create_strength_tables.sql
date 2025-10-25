-- Strength training core tables
CREATE TABLE IF NOT EXISTS muscle_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS exercise_definitions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  primary_muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT,
  secondary_muscle_group_ids INTEGER[] DEFAULT '{}',
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('barbell','dumbbell','machine','bodyweight','cable','kettlebell','other')),
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('compound','isolation')),
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_ex_defs_primary_group ON exercise_definitions(primary_muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_ex_defs_name_trgm ON exercise_definitions USING GIN (name gin_trgm_ops);

-- Users are out of scope; store an opaque user_id string for now
CREATE TABLE IF NOT EXISTS workout_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT,
  notes TEXT,
  duration_minutes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started ON workout_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id SERIAL PRIMARY KEY,
  workout_session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_definition_id INTEGER NOT NULL REFERENCES exercise_definitions(id) ON DELETE RESTRICT,
  ord SMALLINT NOT NULL DEFAULT 1,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_ex ON exercise_logs(exercise_definition_id);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id SERIAL PRIMARY KEY,
  exercise_log_id INTEGER NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_number SMALLINT NOT NULL,
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight NUMERIC(8,2) NOT NULL CHECK (weight >= 0),
  rpe NUMERIC(3,1),
  is_warmup BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_log ON exercise_sets(exercise_log_id);

-- Helper views for metrics (best e1RM per log and volumes)
CREATE OR REPLACE VIEW v_exercise_log_metrics AS
SELECT
  el.id AS exercise_log_id,
  el.workout_session_id,
  el.exercise_definition_id,
  COALESCE(SUM(CASE WHEN es.is_warmup IS FALSE THEN es.reps * es.weight ELSE 0 END), 0) AS total_volume,
  COALESCE(MAX(CASE WHEN es.is_warmup IS FALSE THEN (es.weight * (1 + (es.reps::numeric / 30))) ELSE NULL END), 0) AS best_e1rm
FROM exercise_logs el
LEFT JOIN exercise_sets es ON es.exercise_log_id = el.id
GROUP BY el.id;

CREATE OR REPLACE VIEW v_workout_session_metrics AS
SELECT
  ws.id AS workout_session_id,
  COALESCE(SUM(m.total_volume), 0) AS total_session_volume
FROM workout_sessions ws
LEFT JOIN v_exercise_log_metrics m ON m.workout_session_id = ws.id
GROUP BY ws.id;
