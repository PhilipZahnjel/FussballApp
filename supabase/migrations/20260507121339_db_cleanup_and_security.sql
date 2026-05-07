-- ============================================================
-- DB-Bereinigung & Sicherheitsfixes (2026-05-07)
-- Alle Änderungen wurden bereits auf die Live-DB angewendet.
-- Diese Migration dokumentiert den bereinigten Soll-Zustand.
-- ============================================================

-- ── 1. profiles: 'trainer' als gültige Rolle ergänzen ────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'customer'::text, 'trainer'::text]));

-- ── 2. appointments: program- und Format-Constraints ─────────
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_program_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_program_check
  CHECK (program = ANY (ARRAY[
    'individual'::text, 'gruppe'::text, 'athletik'::text,
    'torhueter_individual'::text, 'torhueter_gruppe'::text
  ]));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_date_format_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_date_format_check
  CHECK (date ~ '^\d{4}-\d{2}-\d{2}$');

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_time_format_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_time_format_check
  CHECK (time ~ '^\d{2}:\d{2}$');

-- ── 3. Indexes für häufige Abfragemuster ─────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_user_date_status
  ON appointments(user_id, date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_date_time_program_status
  ON appointments(date, time, program, status);

CREATE INDEX IF NOT EXISTS idx_appointments_date_status
  ON appointments(date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_trainer_id
  ON appointments(trainer_id);

CREATE INDEX IF NOT EXISTS idx_tokens_user_active
  ON cancellation_tokens(user_id, used_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_tokens_source_appointment_id
  ON cancellation_tokens(source_appointment_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_by
  ON notifications(created_by);

-- ── 4. is_admin(): fester search_path, anon darf nicht aufrufen
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── 5. Trigger-Funktionen: SECURITY INVOKER + fester search_path
-- Trigger-Funktionen brauchen kein SECURITY DEFINER, da RLS-Policies
-- korrekt konfiguriert sind (appointments SELECT gilt für alle authenticated).

GRANT USAGE ON SEQUENCE public.customer_number_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_customer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := nextval('public.customer_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_count INTEGER;
  max_capacity   INTEGER;
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
    FROM public.appointments
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
$$;

CREATE OR REPLACE FUNCTION public.check_daily_booking_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO existing_count
    FROM public.appointments
   WHERE user_id = NEW.user_id
     AND date    = NEW.date
     AND status  = 'confirmed'
     AND id     != NEW.id;

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Bereits ein Termin an diesem Tag gebucht.';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 6. RLS-Policies: konsolidiert (eine Policy pro Operation)
-- Vorher: getrennte admin_* + customer_* Policies → doppelte Auswertung pro Row
-- Jetzt:  eine Policy pro Action mit is_admin() OR eigene Zeile
-- Außerdem: auth.uid() → (select auth.uid()) verhindert Row-Re-evaluation

-- profiles
DROP POLICY IF EXISTS "admin_all_profiles"         ON profiles;
DROP POLICY IF EXISTS "customer_read_own_profile"   ON profiles;
DROP POLICY IF EXISTS "customer_update_own_profile" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING ((select is_admin()) OR (select auth.uid()) = id);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select is_admin()));

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING  ((select is_admin()) OR (select auth.uid()) = id)
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = id);

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING ((select is_admin()));

-- appointments
DROP POLICY IF EXISTS "admin_all_appointments"              ON appointments;
DROP POLICY IF EXISTS "authenticated_read_all_appointments" ON appointments;
DROP POLICY IF EXISTS "customer_insert_own_appointment"     ON appointments;
DROP POLICY IF EXISTS "customer_update_own_appointment"     ON appointments;

-- Alle eingeloggten Nutzer sehen alle Termine (nötig für Slot-Kapazitätsanzeige)
CREATE POLICY "appointments_select" ON appointments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = user_id);

CREATE POLICY "appointments_update" ON appointments
  FOR UPDATE TO authenticated
  USING  ((select is_admin()) OR (select auth.uid()) = user_id)
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = user_id);

CREATE POLICY "appointments_delete" ON appointments
  FOR DELETE TO authenticated
  USING ((select is_admin()));

-- cancellation_tokens
DROP POLICY IF EXISTS "admin_all_tokens"           ON cancellation_tokens;
DROP POLICY IF EXISTS "customer_own_tokens_select" ON cancellation_tokens;
DROP POLICY IF EXISTS "customer_own_tokens_insert" ON cancellation_tokens;
DROP POLICY IF EXISTS "customer_own_tokens_update" ON cancellation_tokens;

CREATE POLICY "tokens_select" ON cancellation_tokens
  FOR SELECT TO authenticated
  USING ((select is_admin()) OR (select auth.uid()) = user_id);

-- INSERT nur wenn ein tatsächlich stornierter Termin des Nutzers existiert
CREATE POLICY "tokens_insert" ON cancellation_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    (select is_admin())
    OR (
      (select auth.uid()) = user_id
      AND source_appointment_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointments
        WHERE id      = source_appointment_id
          AND user_id = (select auth.uid())
          AND status  = 'cancelled'
      )
    )
  );

CREATE POLICY "tokens_update" ON cancellation_tokens
  FOR UPDATE TO authenticated
  USING  ((select is_admin()) OR (select auth.uid()) = user_id)
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = user_id);

CREATE POLICY "tokens_delete" ON cancellation_tokens
  FOR DELETE TO authenticated
  USING ((select is_admin()));

-- notifications
DROP POLICY IF EXISTS "Admin verwaltet"              ON notifications;
DROP POLICY IF EXISTS "Kunden lesen"                 ON notifications;
DROP POLICY IF EXISTS "admin_all_notifications"      ON notifications;
DROP POLICY IF EXISTS "customers_read_notifications" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK ((select is_admin()));

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING  ((select is_admin()))
  WITH CHECK ((select is_admin()));

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated
  USING ((select is_admin()));
