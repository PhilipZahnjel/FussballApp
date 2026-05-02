import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PlayerLevel, PlayerType, BookingPermissions } from '../types';

export type Profile = {
  full_name: string;
  phone: string;
  customer_number: number;
  is_active: boolean;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  parent_name: string | null;
  location: string | null;
  player_type: PlayerType | null;
  role: 'admin' | 'customer' | 'trainer';
  level: PlayerLevel | null;
} & BookingPermissions;

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUserId: string | null = null;

    load().then(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        currentUserId = user?.id ?? null;
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id ?? null;
      if (session?.user) {
        loadForUser(session.user.id, session.user.email ?? null);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`profile-changes-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (currentUserId && payload.new.id === currentUserId) {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) loadForUser(user.id, user.email ?? null);
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const loadForUser = async (userId: string, email: string | null) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data ? { ...data, email: email ?? data.email } as Profile : null);
    setLoading(false);
  };

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    await loadForUser(user.id, user.email ?? null);
  };

  return { profile, loading, reload: load };
}
