-- Kunden dürfen eigene Charges anlegen (für Extra-Termin-Abrechnung)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'charges' AND policyname = 'customer_insert_own_charge'
  ) THEN
    CREATE POLICY "customer_insert_own_charge" ON charges
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
