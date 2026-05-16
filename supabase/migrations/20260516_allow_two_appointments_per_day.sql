-- Erlaubt max. 2 bestätigte Termine pro Kunde pro Tag (vorher: 1).
CREATE OR REPLACE FUNCTION check_daily_booking_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO existing_count
    FROM appointments
   WHERE user_id = NEW.user_id
     AND date    = NEW.date
     AND status  = 'confirmed'
     AND id     != NEW.id;

  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'Bereits zwei Termine an diesem Tag gebucht.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
