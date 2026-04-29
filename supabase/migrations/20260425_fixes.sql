-- =============================================
-- MIGRATION: Bugfixes & Lymph-Rabatt-Flag
-- Im Supabase SQL-Editor ausführen
-- =============================================

-- 1. lymph_discount als Boolean-Flag (ersetzt lymph_discount_percent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lymph_discount boolean NOT NULL DEFAULT false;

-- Bestehende Prozent-Werte migrieren (wer einen Wert hatte, bekommt jetzt das Flag)
UPDATE profiles
  SET lymph_discount = true
  WHERE lymph_discount_percent IS NOT NULL AND lymph_discount_percent > 0;

-- 2. Rabatt-Preis Lymph in Abo-Plänen
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS discounted_lymph_price numeric(10,2) NOT NULL DEFAULT 15.00;

-- 3. Admin darf charges lesen (für Auto-befüllen)
DROP POLICY IF EXISTS "admin_read_charges" ON charges;
CREATE POLICY "admin_read_charges" ON charges
  FOR SELECT TO authenticated
  USING (is_admin());
