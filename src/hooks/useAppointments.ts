import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment, CancellationToken, ProgramCategory } from '../types';
import { PROGRAM_CATEGORY, ProgramId } from '../constants/programs';
import { checkDailyConflict, checkProgramPermission } from '../utils/bookingRules';
import { Profile } from './useProfile';
import { AppointmentService } from '../services/appointmentService';
import { TokenService } from '../services/tokenService';
import { ProfileService } from '../services/profileService';
import { EmailService } from '../services/emailService';

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

    const loadData = async (uid: string) => {
      const [allData, tokenData] = await Promise.all([
        AppointmentService.fetchAll(),
        TokenService.fetchActive(uid),
      ]);
      if (!isMounted) return;
      if (allData.data) {
        const all = allData.data as Appointment[];
        setAppointments(all);
        setMyAppointments(all.filter(a => a.user_id === uid));
      }
      setActiveTokens((tokenData.data ?? []) as CancellationToken[]);
      setLoading(false);
    };

    // INITIAL_SESSION feuert beim Mount mit der aktuellen Session → deckt ersten Load ab.
    // SIGNED_IN deckt den Login-Fall ab.
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      const user = session?.user ?? null;
      if (user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        setUserId(user.id);
        userIdRef.current = user.id;
        loadData(user.id);
      } else if (!user) {
        setAppointments([]);
        setMyAppointments([]);
        setActiveTokens([]);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`appointments-live-${Date.now()}`)
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
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const addAppointment = async (date: string, time: string, program: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { error: { message: 'Nicht eingeloggt.' } };

    const category = getCategory(program);
    const activeToken = activeTokens.find(t => t.category === category);
    if (!activeToken) {
      return { error: { message: 'Nachholtermine können nur mit einem gültigen Stornierungstoken gebucht werden.' } };
    }

    // 4-Wochen-Frist: Buchungsdatum darf max. 28 Tage nach Token-Ausstellung liegen
    const maxDate = new Date(activeToken.issued_at);
    maxDate.setDate(maxDate.getDate() + 28);
    if (new Date(date + 'T12:00:00') > maxDate) {
      return { error: { message: `Nachholtermin muss bis ${maxDate.toLocaleDateString('de-DE')} gebucht werden.` } };
    }

    if (profile) {
      const permCheck = checkProgramPermission(profile, program as ProgramId);
      if (!permCheck.allowed) return { error: { message: permCheck.reason! } };
    }

    const dailyConflict = checkDailyConflict(
      myAppointments.filter(a => a.status === 'confirmed'),
      date,
    );
    if (!dailyConflict.allowed) return { error: { message: dailyConflict.reason! } };

    const { data: profileData } = await ProfileService.fetchById(user.id);
    const birthYear = profile?.birth_date ? parseInt(profile.birth_date.slice(0, 4)) : null;
    const level = profile?.level ?? null;
    const { data, error } = await AppointmentService.insert({
      date, time, status: 'confirmed', user_id: user.id, program,
      ...(birthYear ? { session_birth_year: birthYear } : {}),
      ...(level ? { session_level: level } : {}),
    });

    if (data && !error) {
      const newAppt = data as Appointment;
      setAppointments(prev => [...prev, newAppt]);
      setMyAppointments(prev => [...prev, newAppt]);

      await TokenService.markUsed(activeToken.id);
      setActiveTokens(prev => prev.filter(t => t.id !== activeToken.id));

      EmailService.sendBooking({
        email: user.email ?? '',
        name: profileData?.full_name ?? '',
        date, time, program,
      });
    }
    return { error };
  };

  const cancelAppointment = async (id: string, skipToken = false) => {
    const appt = appointments.find(a => a.id === id);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const { error } = await AppointmentService.updateStatus(id, 'cancelled');

    if (!error && appt && user) {
      const updateAppt = (a: Appointment) =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a;
      setAppointments(prev => prev.map(updateAppt));
      setMyAppointments(prev => prev.map(updateAppt));

      if (!skipToken) {
        const category = getCategory(appt.program);
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        const { data: tokenData } = await TokenService.insert({
          user_id: user.id,
          category,
          expires_at: expiresAt.toISOString(),
          source_appointment_id: id,
        });
        if (tokenData) setActiveTokens(prev => [...prev, tokenData as CancellationToken]);
      }

      const { data: profileData } = await ProfileService.fetchById(user.id);
      EmailService.sendCancellation({
        email: user.email ?? '',
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
