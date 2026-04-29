-- Fix 1: Kunden dürfen eigene Termine lesen
-- War nie als Migration angelegt → Termine verschwinden nach Navigation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments' AND policyname = 'customer_select_own_appointments'
  ) THEN
    CREATE POLICY "customer_select_own_appointments" ON appointments
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Fix 2: Kunden dürfen Guthaben-Transaktionen einfügen (nur -1 oder +1)
-- Fehlte bisher → deductCredit beim Buchen und Erstattung bei Stornierung schlugen still fehl
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'customer_insert_credit'
  ) THEN
    CREATE POLICY "customer_insert_credit" ON credit_transactions
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND amount IN (-1, 1));
  END IF;
END $$;
