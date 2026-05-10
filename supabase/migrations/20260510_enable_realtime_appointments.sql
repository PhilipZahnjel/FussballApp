-- Realtime für appointments-Tabelle aktivieren
-- Ermöglicht Live-Updates wenn Admin Termine anlegt/storniert
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
