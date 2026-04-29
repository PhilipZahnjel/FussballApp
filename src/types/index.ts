export type AppointmentStatus = 'confirmed' | 'cancelled';

export type Appointment = {
  id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  program: string;
  user_id?: string;
};

export type Tab = 'home' | 'termine' | 'buchen' | 'profil';
export type AdminTab = 'dashboard' | 'kunden' | 'kalender';

export type PlayerLevel = 'anfaenger' | 'amateur' | 'profi' | 'experte';

export const LEVEL_COLORS: Record<PlayerLevel, string> = {
  anfaenger: '#4CAF50',
  amateur:   '#FFC107',
  profi:     '#FF9800',
  experte:   '#F44336',
};

export const LEVEL_LABELS: Record<PlayerLevel, string> = {
  anfaenger: 'Anfänger',
  amateur:   'Amateur',
  profi:     'Profi',
  experte:   'Experte',
};

export type ProgramCategory = 'individual' | 'gruppe';

export type CancellationToken = {
  id: string;
  user_id: string;
  category: ProgramCategory;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  source_appointment_id: string | null;
};

export type BookingPermissions = {
  can_book_individual: boolean;
  can_book_gruppe: boolean;
  can_book_athletik: boolean;
  can_book_torhueter_individual: boolean;
  can_book_torhueter_gruppe: boolean;
  quota_individual: number;
  quota_gruppe: number;
};
