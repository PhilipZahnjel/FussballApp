-- book_with_token: Trainer-Kapazitätsprüfung korrigiert
--
-- Bug: COUNT(*) < 4 zählte alle Appointments des Trainers im Slot.
-- Ein Trainer mit einem Individual-Termin (COUNT=1) wurde fälschlicherweise
-- für Gruppe ausgewählt (1 < 4 = true) → Trainer hatte 2 Termine gleichzeitig.
--
-- Fix: Jeder Trainer darf pro Slot nur EIN Programm haben.
-- Individual: Trainer muss komplett frei sein (0 Termine im Slot).
-- Gruppe:     Trainer darf nur dieses eine Gruppen-Programm im Slot haben
--             (kein anderes Programm) und muss noch Platz haben (< 4).

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

  v_needed_spec := CASE p_program
    WHEN 'torhueter_individual' THEN 'torwart'
    WHEN 'torhueter_gruppe'     THEN 'torwart'
    ELSE 'spieler'
  END;

  v_dow := EXTRACT(ISODOW FROM p_date::date)::int;

  -- Trainer-Auswahl: hat den Slot im Zeitplan + exakt ein Programm pro Slot
  SELECT ts.trainer_id INTO v_trainer_id
  FROM public.trainer_schedules ts
  JOIN public.profiles p ON p.id = ts.trainer_id
  WHERE p.role              = 'trainer'
    AND p.trainer_specialty = v_needed_spec
    AND ts.day_of_week      = v_dow
    AND ts."time"           = p_time
    AND CASE
      WHEN v_category = 'individual' THEN
        -- Individual: Trainer muss im Slot komplett frei sein
        NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.trainer_id = ts.trainer_id
            AND a.date       = p_date
            AND a."time"     = p_time
            AND a.status     = 'confirmed'
        )
      ELSE
        -- Gruppe: Trainer hat nur dieses Programm im Slot (kein Mischen)
        -- und noch Kapazität (< 4 Teilnehmer)
        (
          SELECT COUNT(*) FROM public.appointments a
          WHERE a.trainer_id = ts.trainer_id
            AND a.date       = p_date
            AND a."time"     = p_time
            AND a.status     = 'confirmed'
            AND a.program    = p_program
        ) < 4
        AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.trainer_id = ts.trainer_id
            AND a.date       = p_date
            AND a."time"     = p_time
            AND a.status     = 'confirmed'
            AND a.program   != p_program
        )
    END
  -- Gruppen bevorzugt auffüllen (Trainer mit meisten Teilnehmern zuerst)
  ORDER BY (
    SELECT COUNT(*) FROM public.appointments a
    WHERE a.trainer_id = ts.trainer_id
      AND a.date       = p_date
      AND a."time"     = p_time
      AND a.status     = 'confirmed'
      AND a.program    = p_program
  ) DESC
  LIMIT 1;

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

  UPDATE public.cancellation_tokens SET used_at = NOW() WHERE id = p_token_id;

  RETURN json_build_object('appointment', row_to_json(v_appt));
END;
$$;

COMMENT ON FUNCTION public.book_with_token(uuid, text, text, text) IS '@omit';
REVOKE EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.book_with_token(uuid, text, text, text) TO authenticated;
