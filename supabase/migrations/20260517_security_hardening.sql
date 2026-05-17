-- ============================================================
-- Security Hardening (2026-05-17)
-- K1: Restrictive appointments SELECT + SECURITY DEFINER slot functions
-- K2: RLS for trainer_videos
-- K3: Unique token index + atomic cancel_and_issue_token RPC
-- K4: Atomic book_with_token RPC
-- H1: Hide is_admin/slot functions from REST API (@omit)
-- H3: Fix trigger functions – re-apply with SET search_path = ''
-- ============================================================

-- ── K1: Restrictive appointments SELECT ──────────────────────
-- Previously USING (true) – exposed all users' appointments via REST API.
-- Now: admins see all, customers see own, trainers see assigned.
DROP POLICY IF EXISTS "appointments_select" ON appointments;

CREATE POLICY "appointments_select" ON appointments
  FOR SELECT TO authenticated
  USING (
    (select is_admin())
    OR (select auth.uid()) = user_id
    OR (trainer_id IS NOT NULL AND (select auth.uid()) = trainer_id)
  );

-- ── K1: SECURITY DEFINER functions for aggregated slot data ──
-- Customers call these to check slot availability without reading other users' data.

CREATE OR REPLACE FUNCTION public.get_slot_counts()
RETURNS TABLE(date text, "time" text, program text, booked bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT a.date, a.time, a.program, COUNT(*)::bigint AS booked
  FROM public.appointments a
  WHERE a.status = 'confirmed'
  GROUP BY a.date, a.time, a.program;
$$;

COMMENT ON FUNCTION public.get_slot_counts() IS '@omit';
REVOKE EXECUTE ON FUNCTION public.get_slot_counts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_slot_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_slot_players()
RETURNS TABLE(date text, "time" text, program text, session_birth_year int, session_level text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT a.date, a.time, a.program, a.session_birth_year, a.session_level, a.created_at
  FROM public.appointments a
  WHERE a.status = 'confirmed'
    AND a.session_birth_year IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_slot_players() IS '@omit';
REVOKE EXECUTE ON FUNCTION public.get_slot_players() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_slot_players() TO authenticated;

-- ── K2: RLS for trainer_videos ────────────────────────────────
ALTER TABLE IF EXISTS trainer_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_videos_select" ON trainer_videos;
DROP POLICY IF EXISTS "trainer_videos_insert" ON trainer_videos;
DROP POLICY IF EXISTS "trainer_videos_update" ON trainer_videos;
DROP POLICY IF EXISTS "trainer_videos_delete" ON trainer_videos;

CREATE POLICY "trainer_videos_select" ON trainer_videos
  FOR SELECT TO authenticated
  USING ((select is_admin()) OR (select auth.uid()) = trainer_id);

CREATE POLICY "trainer_videos_insert" ON trainer_videos
  FOR INSERT TO authenticated
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = trainer_id);

CREATE POLICY "trainer_videos_update" ON trainer_videos
  FOR UPDATE TO authenticated
  USING  ((select is_admin()) OR (select auth.uid()) = trainer_id)
  WITH CHECK ((select is_admin()) OR (select auth.uid()) = trainer_id);

CREATE POLICY "trainer_videos_delete" ON trainer_videos
  FOR DELETE TO authenticated
  USING ((select is_admin()) OR (select auth.uid()) = trainer_id);

-- ── K3: Unique partial index – one token per cancelled appointment ──
-- Prevents race condition where two concurrent cancellations could issue two tokens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_unique_source
  ON cancellation_tokens(source_appointment_id)
  WHERE source_appointment_id IS NOT NULL;

-- ── K3: Atomic cancel + issue token ──────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_and_issue_token(p_appointment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_appt     public.appointments%ROWTYPE;
  v_token    public.cancellation_tokens%ROWTYPE;
  v_category text;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND ((select auth.uid()) = user_id OR (SELECT public.is_admin()))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Termin nicht gefunden.');
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RETURN json_build_object('error', 'Termin ist bereits storniert.');
  END IF;

  v_category := CASE v_appt.program
    WHEN 'individual'           THEN 'individual'
    WHEN 'torhueter_individual' THEN 'individual'
    ELSE 'gruppe'
  END;

  UPDATE public.appointments SET status = 'cancelled' WHERE id = p_appointment_id;

  INSERT INTO public.cancellation_tokens (user_id, category, expires_at, source_appointment_id)
  VALUES (v_appt.user_id, v_category, NOW() + INTERVAL '1 month', p_appointment_id)
  RETURNING * INTO v_token;

  RETURN json_build_object(
    'appointment_id', p_appointment_id,
    'token',          row_to_json(v_token)
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_and_issue_token(uuid) IS '@omit';
REVOKE EXECUTE ON FUNCTION public.cancel_and_issue_token(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancel_and_issue_token(uuid) TO authenticated;

-- ── K4: Atomic book appointment + mark token used ─────────────
CREATE OR REPLACE FUNCTION public.book_with_token(
  p_token_id  uuid,
  p_date      text,
  p_time      text,
  p_program   text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_token      public.cancellation_tokens%ROWTYPE;
  v_profile    public.profiles%ROWTYPE;
  v_appt       public.appointments%ROWTYPE;
  v_category   text;
  v_birth_year int;
BEGIN
  SELECT * INTO v_token
  FROM public.cancellation_tokens
  WHERE id       = p_token_id
    AND user_id  = (select auth.uid())
    AND used_at  IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Token nicht gefunden oder abgelaufen.');
  END IF;

  IF NOW() > v_token.issued_at + INTERVAL '28 days' THEN
    RETURN json_build_object('error', 'Nachholtermin muss innerhalb von 28 Tagen nach Stornierung gebucht werden.');
  END IF;

  v_category := CASE p_program
    WHEN 'individual'           THEN 'individual'
    WHEN 'torhueter_individual' THEN 'individual'
    ELSE 'gruppe'
  END;

  IF v_token.category != v_category THEN
    RETURN json_build_object('error', 'Token-Kategorie passt nicht zum gewählten Programm.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = (select auth.uid());

  v_birth_year := CASE
    WHEN v_profile.birth_date IS NOT NULL
    THEN EXTRACT(YEAR FROM v_profile.birth_date::date)::int
    ELSE NULL
  END;

  INSERT INTO public.appointments (user_id, date, time, status, program, session_birth_year, session_level)
  VALUES (
    (select auth.uid()), p_date, p_time, 'confirmed', p_program,
    v_birth_year,
    v_profile.level
  )
  RETURNING * INTO v_appt;

  UPDATE public.cancellation_tokens SET used_at = NOW() WHERE id = p_token_id;

  RETURN json_build_object('appointment', row_to_json(v_appt));
END;
$$;

COMMENT ON FUNCTION public.book_with_token(uuid, text, text, text) IS '@omit';
REVOKE EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) TO authenticated;

-- ── H1: Hide is_admin from REST API ──────────────────────────
COMMENT ON FUNCTION public.is_admin() IS '@omit';

-- ── H3: Re-apply trigger functions with SET search_path = '' ──
-- Migrations 20260515 and 20260516 overwrote these without the secure search_path.

CREATE OR REPLACE FUNCTION public.check_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
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

  appt_dow := EXTRACT(ISODOW FROM NEW.date::date)::INTEGER;

  SELECT COUNT(DISTINCT ts.trainer_id) INTO trainer_count
    FROM public.trainer_schedules ts
    JOIN public.profiles p ON p.id = ts.trainer_id AND p.role = 'trainer'
   WHERE p.trainer_specialty = needed_specialty
     AND ts.day_of_week      = appt_dow
     AND ts.time             = NEW.time;

  IF trainer_count = 0 THEN
    trainer_count := 1;
  END IF;

  max_capacity := base_capacity * trainer_count;

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

  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'Bereits zwei Termine an diesem Tag gebucht.';
  END IF;

  RETURN NEW;
END;
$$;
