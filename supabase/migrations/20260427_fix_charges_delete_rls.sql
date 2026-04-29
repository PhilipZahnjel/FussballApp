-- Kunden dürfen eigene pending Charges löschen (bei Stornierung eines Extra-Termins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'charges' AND policyname = 'customer_delete_own_pending_charge'
  ) THEN
    CREATE POLICY "customer_delete_own_pending_charge" ON charges
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id AND status = 'pending');
  END IF;
END $$;
