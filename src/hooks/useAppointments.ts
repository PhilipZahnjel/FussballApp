import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment } from '../types';
import { checkBookingConflict } from '../utils/bookingRules';

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

async function deductCredit(userId: string, program: string, date: string, appointmentId: string) {
  const creditType = program === 'lymph' ? 'lymph' : 'ems';

  const { data: creditData } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', creditType);
  const balance = (creditData ?? []).reduce((s: number, t: any) => s + t.amount, 0);

  const isExtra = balance <= 0;

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: creditType,
    amount: -1,
    reason: isExtra ? 'extra_booking' : 'booking',
    appointment_id: appointmentId,
  });

  if (isExtra) {
    const { data: sub } = await supabase
      .from('customer_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    const plan = (sub as any)?.plan;
    let extraPrice = creditType === 'lymph'
      ? (plan?.extra_lymph_price ?? 25)
      : (plan?.extra_ems_price ?? 25);

    if (creditType === 'lymph') {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('lymph_discount')
        .eq('id', userId)
        .single();
      if (profileData?.lymph_discount && plan?.discounted_lymph_price != null) {
        extraPrice = plan.discounted_lymph_price;
      }
    }

    const period = date.slice(0, 7);
    await supabase.from('charges').insert({
      user_id: userId,
      amount: Math.round(extraPrice * 100) / 100,
      description: `Extra ${creditType === 'lymph' ? 'Lymphdrainage' : 'EMS'}-Termin ${date}`,
      period,
      status: 'pending',
    });
  }
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (user) { setUserId(user.id); userIdRef.current = user.id; }

      const { data: allData } = await supabase
        .from('appointments')
        .select('id, date, time, status, program, user_id')
        .order('date', { ascending: true });

      if (!isMounted) return;
      if (allData) {
        const all = allData as Appointment[];
        setAppointments(all);
        if (user) setMyAppointments(all.filter(a => a.user_id === user.id));
      }
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
    const clientConflict = checkBookingConflict(
      myAppointments.filter(a => a.status === 'confirmed'),
      date,
      program,
    );
    if (!clientConflict.allowed) {
      return { error: { message: clientConflict.reason! } };
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: serverConflicts } = await supabase
      .from('appointments')
      .select('id, program')
      .eq('user_id', user!.id)
      .eq('date', date)
      .eq('status', 'confirmed');

    const serverConflict = checkBookingConflict(
      (serverConflicts ?? []).map(a => ({ ...a, date, time, status: 'confirmed' })),
      date,
      program,
    );
    if (!serverConflict.allowed) {
      return { error: { message: serverConflict.reason! } };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single();

    const { data, error } = await supabase
      .from('appointments')
      .insert({ date, time, status: 'confirmed', user_id: user!.id, program })
      .select('id, date, time, status, program, user_id')
      .single();

    if (data && !error) {
      const newAppt = data as Appointment;
      setAppointments(prev => [...prev, newAppt]);
      setMyAppointments(prev => [...prev, newAppt]);
      callEmailFunction('send-booking-email', {
        email: user!.email,
        name: profile?.full_name ?? '',
        date,
        time,
        program,
      });
      // Guthaben abziehen (awaited damit Profilseite direkt aktuell ist)
      await deductCredit(user!.id, program, date, data.id).catch(e => console.warn('Credit deduction failed:', e));
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

    if (!error) {
      const updateStatus = (a: Appointment) =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a;
      setAppointments(prev => prev.map(updateStatus));
      setMyAppointments(prev => prev.map(updateStatus));

      // Guthaben erstatten (awaited damit Profilseite direkt aktuell ist)
      const { data: creditTx } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('appointment_id', id)
        .maybeSingle();
      if (creditTx) {
        await supabase.from('credit_transactions').insert({
          user_id: user!.id,
          type: creditTx.type,
          amount: 1,
          reason: 'cancellation',
          appointment_id: id,
        });
        if (creditTx.reason === 'extra_booking' && appt) {
          const typeLabel = creditTx.type === 'lymph' ? 'Lymphdrainage' : 'EMS';
          await supabase.from('charges').delete()
            .eq('user_id', user!.id)
            .eq('status', 'pending')
            .eq('description', `Extra ${typeLabel}-Termin ${appt.date}`);
        }
      }

      if (appt) {
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
    }
    return { error };
  };

  return { appointments, myAppointments, loading, addAppointment, cancelAppointment, userId };
}
