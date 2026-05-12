import { supabase } from '../lib/supabase';

export const ProfileService = {
  fetchById: (userId: string) =>
    supabase.from('profiles').select('*').eq('id', userId).single(),

  fetchAllCustomers: () =>
    supabase.from('profiles').select('*').eq('role', 'customer').order('full_name'),

  fetchTrainers: () =>
    supabase
      .from('profiles')
      .select('id, full_name, trainer_specialty')
      .eq('role', 'trainer')
      .order('full_name'),

  update: (userId: string, fields: Record<string, unknown>) =>
    supabase.from('profiles').update(fields).eq('id', userId),
};
