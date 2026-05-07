-- FK-Constraints: ON DELETE SET NULL für trainer_id und created_by
-- Verhindert 500-Fehler beim Löschen von Kunden die als Trainer oder Benachrichtigungs-Ersteller referenziert werden

ALTER TABLE appointments
  DROP CONSTRAINT appointments_trainer_id_fkey,
  ADD CONSTRAINT appointments_trainer_id_fkey
    FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE notifications
  DROP CONSTRAINT notifications_created_by_fkey,
  ADD CONSTRAINT notifications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
