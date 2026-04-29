-- =============================================
-- MIGRATION: Abonnements & Guthaben
-- Im Supabase SQL-Editor ausführen
-- =============================================

-- 1. Abo-Pläne (Vorlagen, admin-verwaltet)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ems_credits_per_month int NOT NULL DEFAULT 0,
  lymph_credits_per_month int NOT NULL DEFAULT 0,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  extra_ems_price numeric(10,2) NOT NULL DEFAULT 25.00,
  extra_lymph_price numeric(10,2) NOT NULL DEFAULT 20.00,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_plans" ON subscription_plans
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_read_plans" ON subscription_plans
  FOR SELECT TO authenticated
  USING (true);

-- 2. Kunden-Abonnements (welcher Kunde hat welches Abo)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_subs" ON customer_subscriptions
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_own_subs" ON customer_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Guthaben-Transaktionen (Quelle der Wahrheit für Salden)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ems', 'lymph')),
  amount int NOT NULL,
  reason text NOT NULL CHECK (reason IN ('subscription', 'booking', 'extra_booking', 'manual', 'cancellation')),
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_credits" ON credit_transactions
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_own_credits" ON credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Lymphdrainage-Rabatt zu profiles hinzufügen
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lymph_discount_percent int
  DEFAULT NULL
  CHECK (lymph_discount_percent IS NULL OR (lymph_discount_percent >= 0 AND lymph_discount_percent <= 100));

-- Fertig! Tabellen und RLS sind eingerichtet.
