import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment, CancellationToken, ProgramCategory } from '../types';
import { PROGRAM_CATEGORY, ProgramId } from '../constants/programs';
import { checkDailyConflict, checkProgramPermission, checkMonthlyQuota } from '../utils/bookingRules';
import { Profile } from './useProfile';

async function callEmailFunction(name: string, body: object): Promise<void> {
  const functionsUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!functionsUrl) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${functionsUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`E-Mail-Funktion "${name}" fehlgeschlagen:`, res.status, await res.text());
    }
  } catch (e) {
    console.warn(`E-Mail-Funktion "${name}" nicht erreichbar:`, e);
  }
}

function getCategory(program: string): ProgramCategory {
  return PROGRAM_CATEGORY[program as ProgramId] ?? 'individual';
}

export function useAppointments(profile: Profile | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [activeTokens, setActiveTokens] = useState<CancellationToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (user) { setUserId(user.id); userIdRef.current = user.id; }

      const [allData, tokenData] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, date, time, status, program, user_id')
          .order('date', { ascending: true }),
        user
          ? supabase
              .from('cancellation_tokens')
              .select('*')
              .eq('user_id', user.id)
              .is('used_at', null)
              .gt('expires_at', new Date().toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      if (!isMounted) return;
      if (allData.data) {
        const all = allData.data as Appointment[];
        setAppointments(all);
        if (user) setMyAppointments(all.filter(a => a.user_id === user.id));
      }
      setActiveTokens((tokenData.data ?? []) as CancellationToken[]);
      setLoading(false);
    };

    init();

    const channel = supabase
      .channel('appointments-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, (payload) => {
        if (!isMounted) return;
        const appt = payload.new as Appointment;
        setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [...prev, appt]);
        if (userIdRef.current && appt.user_id === userIdRef.current) {
          setMyAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [...prev, appt]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, (payload) => {
        if (!isMounted) return;
        const appt = payload.new as Appointment;
        setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a));
        setMyAppointments(prev => prev.map(a => a.id === appt.id ? appt : a));
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addAppointment = async (date: string, time: string, program: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Nicht eingeloggt.' } };

    // Berechtigung prüfen
    if (profile) {
      const permCheck = checkProgramPermission(profile, program as ProgramId);
      if (!permCheck.allowed) return { error: { message: permCheck.reason! } };
    }

    // Tages-Konflikt prüfen (client-seitig)
    const dailyConflict = checkDailyConflict(
      myAppointments.filter(a => a.status === 'confirmed'),
      date,
    );
    if (!dailyConflict.allowed) return { error: { message: dailyConflict.reason! } };

    // Monatliches Kontingent prüfen
    const category = getCategory(program);
    const activeToken = activeTokens.find(t => t.category === category);
    if (profile) {
      const quotaCheck = checkMonthlyQuota(myAppointments, profile, program as ProgramId, date.slice(0, 7), !!activeToken);
      if (!quotaCheck.allowed) return { error: { message: quotaCheck.reason! } };
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase
      .from('appointments')
      .insert({ date, time, status: 'confirmed', user_id: user.id, program })
      .select('id, date, time, status, program, user_id')
      .single();

    if (data && !error) {
      const newAppt = data as Appointment;
      setAppointments(prev => [...prev, newAppt]);
      setMyAppointments(prev => [...prev, newAppt]);

      // Verwendeten Token markieren
      if (activeToken) {
        await supabase
          .from('cancellation_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', activeToken.id);
        setActiveTokens(prev => prev.filter(t => t.id !== activeToken.id));
      }

      callEmailFunction('send-booking-email', {
        email: user.email,
        name: profileData?.full_name ?? '',
        date,
        time,
        program,
      });
    }
    return { error };
  };

  const cancelAppointment = async (id: string) => {
    const appt = appointments.find(a => a.id === id);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (!error && appt) {
      const updateStatus = (a: Appointment) =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a;
      setAppointments(prev => prev.map(updateStatus));
      setMyAppointments(prev => prev.map(updateStatus));

      // Stornierungstoken ausstellen
      const category = getCategory(appt.program);
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const { data: tokenData } = await supabase
        .from('cancellation_tokens')
        .insert({
          user_id: user!.id,
          category,
          expires_at: expiresAt.toISOString(),
          source_appointment_id: id,
        })
        .select('*')
        .single();
      if (tokenData) {
        setActiveTokens(prev => [...prev, tokenData as CancellationToken]);
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .single();
      callEmailFunction('send-cancellation-email', {
        email: user!.email,
        name: profileData?.full_name ?? '',
        date: appt.date,
        time: appt.time,
        program: appt.program,
      });
    }
    return { error };
  };

  return { appointments, myAppointments, activeTokens, loading, addAppointment, cancelAppointment, userId };
}
