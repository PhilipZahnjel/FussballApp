import { supabase } from '../lib/supabase';

export const TrainerScheduleService = {
  fetchAll: () =>
    supabase.from('trainer_schedules').select('*'),

  upsert: (entry: { trainer_id: string; day_of_week: number; time: string }) =>
    supabase.from('trainer_schedules').upsert(entry),

  deleteEntry: (trainer_id: string, day_of_week: number, time: string) =>
    supabase
      .from('trainer_schedules')
      .delete()
      .eq('trainer_id', trainer_id)
      .eq('day_of_week', day_of_week)
      .eq('time', time),
};
