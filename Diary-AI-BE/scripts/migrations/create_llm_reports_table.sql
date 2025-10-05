CREATE TABLE IF NOT EXISTS ai_llm_daily_reports (
  id SERIAL PRIMARY KEY,
  day DATE NOT NULL,
  language TEXT NOT NULL DEFAULT 'pl',
  days_window INTEGER NOT NULL DEFAULT 30,
  report TEXT NOT NULL,
  raw_json JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(day, language)
);

-- Index for latest queries
CREATE INDEX IF NOT EXISTS idx_ai_llm_daily_reports_day ON ai_llm_daily_reports(day DESC);
