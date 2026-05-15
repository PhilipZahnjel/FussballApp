-- Slot-Kapazität dynamisch nach Trainer-Anzahl berechnen.
-- Individual: 1 pro verfügbarem Trainer. Gruppe/Athletik/Torwart-Gruppe: 4 pro Trainer.
CREATE OR REPLACE FUNCTION check_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  max_capacity   INTEGER;
  base_capacity  INTEGER;
  trainer_count  INTEGER;
  needed_specialty TEXT;
  appt_dow       INTEGER;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  base_capacity := CASE NEW.program
    WHEN 'individual'           THEN 1
    WHEN 'torhueter_individual' THEN 1
    WHEN 'gruppe'               THEN 4
    WHEN 'athletik'             THEN 4
    WHEN 'torhueter_gruppe'     THEN 4
    ELSE 1
  END;

  needed_specialty := CASE NEW.program
    WHEN 'torhueter_individual' THEN 'torwart'
    WHEN 'torhueter_gruppe'     THEN 'torwart'
    ELSE 'spieler'
  END;

  -- ISO-Wochentag (1=Mo … 7=So), trainer_schedules speichert 1–5
  appt_dow := EXTRACT(ISODOW FROM NEW.date::date)::INTEGER;

  SELECT COUNT(DISTINCT ts.trainer_id) INTO trainer_count
    FROM trainer_schedules ts
    JOIN profiles p ON p.id = ts.trainer_id AND p.role = 'trainer'
   WHERE p.trainer_specialty = needed_specialty
     AND ts.day_of_week      = appt_dow
     AND ts.time             = NEW.time;

  -- Kein Trainer eingetragen → Basis-Kapazität als Fallback
  IF trainer_count = 0 THEN
    trainer_count := 1;
  END IF;

  max_capacity := base_capacity * trainer_count;

  SELECT COUNT(*) INTO existing_count
    FROM appointments
   WHERE date    = NEW.date
     AND time    = NEW.time
     AND program = NEW.program
     AND status  = 'confirmed'
     AND id     != NEW.id;

  IF existing_count >= max_capacity THEN
    RAISE EXCEPTION 'Dieser Slot ist bereits ausgebucht.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
