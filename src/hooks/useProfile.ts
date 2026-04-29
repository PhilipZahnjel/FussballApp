import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PlayerLevel, BookingPermissions } from '../types';

export type Profile = {
  full_name: string;
  phone: string;
  customer_number: number;
  is_active: boolean;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  role: 'admin' | 'customer';
  level: PlayerLevel | null;
} & BookingPermissions;

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile({ ...(data ?? {}), email: user.email ?? null } as Profile);
    setLoading(false);
  };

  return { profile, loading };
}
