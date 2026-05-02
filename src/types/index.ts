export type AppointmentStatus = 'confirmed' | 'cancelled';

export type Appointment = {
  id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  program: string;
  user_id?: string;
  trainer_id?: string | null;
  session_level?: string | null;
  session_birth_year?: number | null;
};

export type Tab = 'home' | 'termine' | 'buchen' | 'infos' | 'profil';
export type AdminTab = 'dashboard' | 'kunden' | 'kalender' | 'infos';

export type PlayerLevel = 'gruen' | 'gelb' | 'orange' | 'rot';
export type PlayerType = 'torwart' | 'feldspieler';

export const LEVEL_COLORS: Record<PlayerLevel, string> = {
  gruen:  '#4CAF50',
  gelb:   '#FFC107',
  orange: '#FF9800',
  rot:    '#F44336',
};

export const LEVEL_LABELS: Record<PlayerLevel, string> = {
  gruen:  'Grün',
  gelb:   'Gelb',
  orange: 'Orange',
  rot:    'Rot',
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

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  location: string | null;
  created_at: string;
  is_global: boolean;
};
