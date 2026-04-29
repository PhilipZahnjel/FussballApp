import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Measurement } from '../types';

export function useMeasurements() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false });

    if (data) setMeasurements(data as Measurement[]);
    setLoading(false);
  };

  return { measurements, latest: measurements[0] ?? null, loading };
}
