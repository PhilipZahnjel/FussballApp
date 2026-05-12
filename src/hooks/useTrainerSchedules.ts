import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrainerSchedule, TrainerSpecialty } from '../types';

export type TrainerWithSpecialty = {
  id: string;
  full_name: string;
  trainer_specialty?: TrainerSpecialty | null;
};

export function useTrainerSchedules() {
  const [trainerSchedules, setTrainerSchedules] = useState<TrainerSchedule[]>([]);
  const [trainers, setTrainers] = useState<TrainerWithSpecialty[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('trainer_schedules').select('*'),
      supabase
        .from('profiles')
        .select('id, full_name, trainer_specialty')
        .in('role', ['admin', 'trainer'])
        .order('full_name'),
    ]).then(([s, t]) => {
      if (s.data) setTrainerSchedules(s.data as TrainerSchedule[]);
      if (t.data) setTrainers(t.data as TrainerWithSpecialty[]);
    });
  }, []);

  return { trainerSchedules, trainers };
}
