import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PlayerLevel, PlayerType, BookingPermissions } from '../types';
import { ProfileService } from '../services/profileService';

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

    const loadForUser = async (userId: string, email: string | null) => {
      const { data } = await ProfileService.fetchById(userId);
      setProfile(data ? { ...data, email: email ?? data.email } as Profile : null);
      setLoading(false);
    };

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
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) loadForUser(session.user.id, session.user.email ?? null);
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const reload = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await ProfileService.fetchById(session.user.id);
    setProfile(data ? { ...data, email: session.user.email ?? data.email } as Profile : null);
  };

  return { profile, loading, reload };
}
