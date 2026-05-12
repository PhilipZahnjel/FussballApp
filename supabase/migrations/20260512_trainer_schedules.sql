-- Specialty-Spalte auf profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trainer_specialty text
  CHECK (trainer_specialty IN ('spieler', 'torwart'));

-- Neue Tabelle
CREATE TABLE IF NOT EXISTS trainer_schedules (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  time          text NOT NULL CHECK (time ~ '^\d{2}:\d{2}$'),
  UNIQUE (trainer_id, day_of_week, time)
);

ALTER TABLE trainer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_read" ON trainer_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ts_admin_write" ON trainer_schedules
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_trainer_schedules_trainer_day
  ON trainer_schedules (trainer_id, day_of_week);
