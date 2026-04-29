-- FussballApp: Umbau von EMS-Studio zu Fußballschule
-- Zahlungssystem raus, Level/Berechtigungen/Kontingente rein

-- 1. Neue Spalten zu profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS level text
    CHECK (level IN ('anfaenger', 'amateur', 'profi', 'experte')),
  ADD COLUMN IF NOT EXISTS can_book_individual boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_book_gruppe boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_book_athletik boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_book_torhueter_individual boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_book_torhueter_gruppe boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quota_individual int DEFAULT 0 CHECK (quota_individual BETWEEN 0 AND 4),
  ADD COLUMN IF NOT EXISTS quota_gruppe int DEFAULT 0 CHECK (quota_gruppe BETWEEN 0 AND 4);

-- 2. SEPA/Zahlungsfelder entfernen
ALTER TABLE profiles
  DROP COLUMN IF EXISTS iban,
  DROP COLUMN IF EXISTS bic,
  DROP COLUMN IF EXISTS account_holder,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS mandate_reference,
  DROP COLUMN IF EXISTS mandate_date,
  DROP COLUMN IF EXISTS lymph_discount,
  DROP COLUMN IF EXISTS lymph_discount_percent;

-- 3. Stornierungstoken-Tabelle (kategorie-spezifisch)
CREATE TABLE IF NOT EXISTS cancellation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('individual', 'gruppe')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  used_at timestamptz,
  source_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL
);

ALTER TABLE cancellation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_tokens" ON cancellation_tokens
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_own_tokens" ON cancellation_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "customer_insert_own_token" ON cancellation_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customer_update_own_token" ON cancellation_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Slot-Kapazität-Trigger: variabel je Trainingstyp
DROP TRIGGER IF EXISTS enforce_slot_capacity ON appointments;
DROP FUNCTION IF EXISTS check_slot_capacity();

CREATE OR REPLACE FUNCTION check_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  max_capacity INTEGER;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  max_capacity := CASE NEW.program
    WHEN 'individual'           THEN 1
    WHEN 'torhueter_individual' THEN 1
    WHEN 'gruppe'               THEN 4
    WHEN 'athletik'             THEN 4
    WHEN 'torhueter_gruppe'     THEN 4
    ELSE 1
  END;

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

CREATE TRIGGER enforce_slot_capacity
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_slot_capacity();

-- 5. Tages-Limit-Trigger: 1 Termin/Tag, keine Ausnahmen mehr
DROP TRIGGER IF EXISTS enforce_daily_booking_limit ON appointments;
DROP FUNCTION IF EXISTS check_daily_booking_limit();

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

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Bereits ein Termin an diesem Tag gebucht.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_daily_booking_limit
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_daily_booking_limit();

-- 6. Zahlungstabellen löschen (Reihenfolge wegen FK!)
DROP TABLE IF EXISTS charges CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS customer_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS consultation_requests CASCADE;
DROP TABLE IF EXISTS measurements CASCADE;
