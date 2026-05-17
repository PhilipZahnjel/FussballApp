-- book_with_token: SECURITY DEFINER + automatische Trainer-Zuweisung
--
-- Warum SECURITY DEFINER:
--   Als SECURITY INVOKER lief die Funktion als Kunde. Die Kapazitätsprüfung
--   (SELECT COUNT(*) FROM appointments WHERE trainer_id = ...)  sah durch die
--   restriktive RLS nur die eigenen Termine des Kunden → falsche Zählung.
--   SECURITY DEFINER umgeht die RLS für interne Queries, ist aber sicher weil
--   die Funktion explizit auth.uid() prüft und nur für den eigenen User bucht.

CREATE OR REPLACE FUNCTION public.book_with_token(
  p_token_id  uuid,
  p_date      text,
  p_time      text,
  p_program   text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token        public.cancellation_tokens%ROWTYPE;
  v_profile      public.profiles%ROWTYPE;
  v_appt         public.appointments%ROWTYPE;
  v_category     text;
  v_birth_year   int;
  v_trainer_id   uuid;
  v_needed_spec  text;
  v_dow          int;
BEGIN
  -- Token validieren (gehört dem aufrufenden User)
  SELECT * INTO v_token
  FROM public.cancellation_tokens
  WHERE id        = p_token_id
    AND user_id   = (SELECT auth.uid())
    AND used_at   IS NULL
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

  SELECT * INTO v_profile FROM public.profiles WHERE id = (SELECT auth.uid());

  v_birth_year := CASE
    WHEN v_profile.birth_date IS NOT NULL
    THEN EXTRACT(YEAR FROM v_profile.birth_date::date)::int
    ELSE NULL
  END;

  -- Benötigte Trainer-Spezialität bestimmen
  v_needed_spec := CASE p_program
    WHEN 'torhueter_individual' THEN 'torwart'
    WHEN 'torhueter_gruppe'     THEN 'torwart'
    ELSE 'spieler'
  END;

  -- Wochentag (ISO: Mo=1 … So=7)
  v_dow := EXTRACT(ISODOW FROM p_date::date)::int;

  -- Freien Trainer finden: hat den Slot im Zeitplan UND noch Kapazität
  -- Gruppen: Trainer mit bereits vorhandenen Teilnehmern bevorzugen (Gruppen auffüllen)
  -- Individual: ersten freien Trainer nehmen
  SELECT ts.trainer_id INTO v_trainer_id
  FROM public.trainer_schedules ts
  JOIN public.profiles p ON p.id = ts.trainer_id
  WHERE p.role              = 'trainer'
    AND p.trainer_specialty = v_needed_spec
    AND ts.day_of_week      = v_dow
    AND ts."time"           = p_time
    AND (
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.trainer_id = ts.trainer_id
        AND a.date       = p_date
        AND a."time"     = p_time
        AND a.status     = 'confirmed'
    ) < CASE v_category WHEN 'individual' THEN 1 ELSE 4 END
  ORDER BY (
    SELECT COUNT(*)
    FROM public.appointments a
    WHERE a.trainer_id = ts.trainer_id
      AND a.date       = p_date
      AND a."time"     = p_time
      AND a.status     = 'confirmed'
  ) DESC
  LIMIT 1;

  -- Termin anlegen (mit Trainer-Zuweisung)
  INSERT INTO public.appointments
    (user_id, date, "time", status, program, trainer_id, session_birth_year, session_level)
  VALUES (
    (SELECT auth.uid()),
    p_date, p_time, 'confirmed', p_program,
    v_trainer_id,
    v_birth_year,
    v_profile.level
  )
  RETURNING * INTO v_appt;

  -- Token als verbraucht markieren
  UPDATE public.cancellation_tokens SET used_at = NOW() WHERE id = p_token_id;

  RETURN json_build_object('appointment', row_to_json(v_appt));
END;
$$;

COMMENT ON FUNCTION public.book_with_token(uuid, text, text, text) IS '@omit';
REVOKE EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) TO authenticated;
