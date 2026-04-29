-- =============================================
-- MIGRATION: Beratungsanfragen von der Website
-- Im Supabase SQL-Editor ausführen
-- =============================================

CREATE TABLE IF NOT EXISTS consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  date date NOT NULL,
  time text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

-- Nur Admins können Beratungsanfragen sehen und verwalten
CREATE POLICY "admin_all_consultations" ON consultation_requests
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Edge Function (Service Role) darf inserieren
-- (Service Role umgeht RLS automatisch)
