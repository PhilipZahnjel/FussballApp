-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 1: Max. 2 Personen pro Zeitslot (Race-Condition-Schutz)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  slot_count INTEGER;
BEGIN
  IF NEW.status = 'confirmed' THEN
    SELECT COUNT(*)
      INTO slot_count
      FROM appointments
     WHERE date   = NEW.date
       AND time   = NEW.time
       AND status = 'confirmed'
       AND id    != NEW.id;  -- eigene Zeile bei UPDATE nicht zählen

    IF slot_count >= 2 THEN
      RAISE EXCEPTION 'Dieser Zeitslot ist bereits ausgebucht (max. 2 Personen).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_slot_capacity ON appointments;
CREATE TRIGGER enforce_slot_capacity
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_slot_capacity();


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 2: Max. 1 Termin pro Tag pro Nutzer (Lymph-Ausnahme beachten)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_daily_booking_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_count   INTEGER;
  has_lymph        BOOLEAN;
  new_is_lymph     BOOLEAN;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  new_is_lymph := (NEW.program = 'lymph');

  SELECT COUNT(*),
         BOOL_OR(program = 'lymph')
    INTO existing_count, has_lymph
    FROM appointments
   WHERE user_id = NEW.user_id
     AND date    = NEW.date
     AND status  = 'confirmed'
     AND id     != NEW.id;

  IF existing_count = 0 THEN
    RETURN NEW;  -- kein Konflikt
  END IF;

  -- Ausnahme: Lymph darf zusätzlich zu einem anderen Termin gebucht werden
  -- und ein anderer Termin darf zusätzlich zu Lymph gebucht werden
  IF new_is_lymph OR has_lymph THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Bereits ein Termin an diesem Tag gebucht. Ausnahme gilt nur für Lymphdrainage.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_daily_booking_limit ON appointments;
CREATE TRIGGER enforce_daily_booking_limit
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_booking_limit();
