-- Migration: add hrv_ms column to daily_journal
-- Date: 2025-09-27
-- Idempotent (safe to run multiple times)
ALTER TABLE daily_journal
  ADD COLUMN IF NOT EXISTS hrv_ms numeric(10,2);

-- Optional: sanity constraint (commented out initially)
-- ALTER TABLE daily_journal ADD CONSTRAINT chk_hrv_ms_range CHECK (hrv_ms IS NULL OR (hrv_ms BETWEEN 5 AND 250));

-- Backfill placeholder HRV values (60-90 ms) ONLY for rows that don't already have hrv_ms.
-- Simple deterministic spread using modulo on day text hashed via length and ASCII sum for reproducibility without extra functions.
WITH candidates AS (
  SELECT day
  FROM daily_journal
  WHERE hrv_ms IS NULL
), base AS (
  SELECT c.day,
         -- produce pseudo-random-ish 0..30 offset
         ( ( (ASCII(SUBSTRING(c.day::text,1,1)) + ASCII(SUBSTRING(c.day::text,2,1)) + EXTRACT(DOY FROM c.day)::int ) % 31 ) ) AS off
  FROM candidates c
)
UPDATE daily_journal dj
SET hrv_ms = 60 + (b.off)::numeric  -- results in 60..90
FROM base b
WHERE dj.day = b.day;

-- Verification query suggestion:
-- SELECT MIN(hrv_ms), MAX(hrv_ms), COUNT(*) FROM daily_journal;
