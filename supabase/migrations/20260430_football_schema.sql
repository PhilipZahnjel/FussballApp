-- ============================================================
-- FussballApp – Vollständiges Datenbankschema (neues Projekt)
-- Läuft im leeren Supabase-Projekt, erstellt alles von Grund auf
-- ============================================================

-- ── 1. profiles-Tabelle ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                   text    NOT NULL DEFAULT '',
  email                       text,
  phone                       text,
  birth_date                  text,
  address                     text,
  customer_number             int     UNIQUE,
  is_active                   boolean NOT NULL DEFAULT true,
  role                        text    NOT NULL DEFAULT 'customer'
                                CHECK (role IN ('admin', 'customer')),
  -- Level-System
  level                       text    CHECK (level IN ('anfaenger', 'amateur', 'profi', 'experte')),
  -- Buchungsberechtigungen (Admin setzt diese Flags)
  can_book_individual         boolean NOT NULL DEFAULT false,
  can_book_gruppe             boolean NOT NULL DEFAULT false,
  can_book_athletik           boolean NOT NULL DEFAULT false,
  can_book_torhueter_individual boolean NOT NULL DEFAULT false,
  can_book_torhueter_gruppe   boolean NOT NULL DEFAULT false,
  -- Monatliche Kontingente (0–4)
  quota_individual            int     NOT NULL DEFAULT 0
                                CHECK (quota_individual BETWEEN 0 AND 4),
  quota_gruppe                int     NOT NULL DEFAULT 0
                                CHECK (quota_gruppe BETWEEN 0 AND 4),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Kundennummer-Sequenz (startet bei 101) ────────────────
CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 101;

CREATE OR REPLACE FUNCTION assign_customer_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := nextval('customer_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_customer_number_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_customer_number();

-- ── 3. is_admin() Hilfsfunktion (SECURITY DEFINER) ───────────
-- Muss nach profiles angelegt werden
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 4. RLS für profiles ──────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_read_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "customer_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ── 5. appointments-Tabelle ──────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       text        NOT NULL,
  time       text        NOT NULL,
  status     text        NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'cancelled')),
  program    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 6. RLS für appointments ──────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_appointments" ON appointments
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Alle eingeloggten Nutzer dürfen alle Termine lesen (für Slot-Kapazität)
CREATE POLICY "authenticated_read_all_appointments" ON appointments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "customer_insert_own_appointment" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customer_update_own_appointment" ON appointments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ── 7. Slot-Kapazität-Trigger (je nach Trainingstyp) ─────────
CREATE OR REPLACE FUNCTION check_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  max_capacity   INTEGER;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  max_capacity := CASE NEW.program
    WHEN 'individual'             THEN 1
    WHEN 'torhueter_individual'   THEN 1
    WHEN 'gruppe'                 THEN 4
    WHEN 'athletik'               THEN 4
    WHEN 'torhueter_gruppe'       THEN 4
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

-- ── 8. Tages-Limit-Trigger (max. 1 Termin/Tag pro Nutzer) ────
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

-- ── 9. cancellation_tokens-Tabelle ───────────────────────────
CREATE TABLE IF NOT EXISTS cancellation_tokens (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category              text        NOT NULL CHECK (category IN ('individual', 'gruppe')),
  issued_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  used_at               timestamptz,
  source_appointment_id uuid        REFERENCES appointments(id) ON DELETE SET NULL
);

-- ── 10. RLS für cancellation_tokens ─────────────────────────
ALTER TABLE cancellation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_tokens" ON cancellation_tokens
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_own_tokens_select" ON cancellation_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "customer_own_tokens_insert" ON cancellation_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customer_own_tokens_update" ON cancellation_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
