-- Kunden dürfen Trainer- und Admin-Profile lesen (für Zeitplan-Filterung im BuchenScreen)
CREATE POLICY "profiles_read_trainers" ON profiles
  FOR SELECT TO authenticated
  USING (role IN ('trainer', 'admin'));
