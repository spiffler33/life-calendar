-- Add is_holiday column to daily_entries for rest day functionality
-- Rest days allow users to mark days where habit streaks don't break

ALTER TABLE daily_entries ADD COLUMN is_holiday BOOLEAN DEFAULT FALSE;
