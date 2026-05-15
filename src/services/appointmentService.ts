import { supabase } from '../lib/supabase';

const SELECT = 'id, date, time, status, program, user_id, trainer_id, session_birth_year, session_level, created_at';

export type AppointmentInsert = {
  user_id: string;
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled';
  program: string;
  trainer_id?: string | null;
  session_birth_year?: number | null;
  session_level?: string | null;
};

export const AppointmentService = {
  fetchAll: () =>
    supabase.from('appointments').select(SELECT).order('date', { ascending: true }),

  fetchAllDesc: () =>
    supabase.from('appointments').select(SELECT).order('date', { ascending: false }),

  insert: (data: AppointmentInsert) =>
    supabase.from('appointments').insert(data).select(SELECT).single(),

  updateStatus: (id: string, status: 'confirmed' | 'cancelled') =>
    supabase.from('appointments').update({ status }).eq('id', id),

  checkDailyConflict: (userId: string, date: string) =>
    supabase
      .from('appointments')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('status', 'confirmed'),
};
