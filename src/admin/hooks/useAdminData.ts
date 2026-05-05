import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PlayerLevel, PlayerType, BookingPermissions } from '../../types';

export type CustomerProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  birth_date: string | null;
  address: string | null;
  parent_name: string | null;
  location: string | null;
  player_type: PlayerType | null;
  customer_number: number;
  is_active: boolean;
  role: string;
  level: PlayerLevel | null;
} & BookingPermissions;

export type AdminAppointment = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled';
  program: string;
  trainer_id?: string | null;
  session_level?: string | null;
  session_birth_year?: number | null;
};

export type TrainerProfile = {
  id: string;
  full_name: string;
};

export function useAdminData() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [allAppointments, setAllAppointments] = useState<AdminAppointment[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [
      { data: profiles, error: profilesErr },
      { data: appointments, error: apptsErr },
      { data: trainerProfiles },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'customer').order('full_name'),
      supabase.from('appointments').select('*').order('date', { ascending: false }),
      supabase.from('profiles').select('id, full_name').in('role', ['admin', 'trainer']).order('full_name'),
    ]);
    if (profilesErr || apptsErr) {
      setLoadError(profilesErr?.message ?? apptsErr?.message ?? 'Fehler beim Laden.');
    }
    setCustomers((profiles ?? []) as CustomerProfile[]);
    setAllAppointments((appointments ?? []) as AdminAppointment[]);
    setTrainers((trainerProfiles ?? []) as TrainerProfile[]);
    setLoading(false);
  };

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      setAllAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a));
    }
    return { error };
  };

  const addAppointmentForCustomer = async (
    userId: string, date: string, time: string, program: string,
    trainerId?: string | null,
    sessionBirthYear?: number | null,
    sessionLevel?: string | null,
  ) => {
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('status', 'confirmed');

    if (conflicts && conflicts.length > 0) {
      return { error: { message: 'Der Kunde hat an diesem Tag bereits einen Termin.' } };
    }

    const insertData: Record<string, any> = { user_id: userId, date, time, status: 'confirmed', program };
    if (trainerId) insertData.trainer_id = trainerId;
    if (sessionBirthYear != null) insertData.session_birth_year = sessionBirthYear;
    if (sessionLevel) insertData.session_level = sessionLevel;

    const { data, error } = await supabase
      .from('appointments')
      .insert(insertData)
      .select('id, date, time, status, program, user_id, trainer_id, session_birth_year, session_level')
      .single();

    if (data && !error) {
      setAllAppointments(prev => [...prev, data as AdminAppointment]);
    }
    return { error };
  };

  const createCustomer = async (params: {
    email: string;
    full_name: string;
    phone: string;
    birth_date: string;
    address: string;
    parent_name: string;
    player_type: PlayerType | null;
  }): Promise<{ error: string | null; tempPassword?: string; customerNumber?: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-customer', { body: params });
      if (error) return { error: error.message ?? JSON.stringify(error) };
      if (data?.error) return { error: data.error as string };
      await load();
      return { error: null, tempPassword: data.temp_password, customerNumber: data.customer_number };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  };

  const deleteCustomer = async (customerId: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-customer', { body: { customerId } });
      if (error) return { error: error.message ?? JSON.stringify(error) };
      if (data?.error) return { error: data.error as string };
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setAllAppointments(prev => prev.filter(a => a.user_id !== customerId));
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  };

  const saveCustomerLevel = async (customerId: string, level: PlayerLevel | null) => {
    const { error } = await supabase.from('profiles').update({ level }).eq('id', customerId);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, level } : c));
    return { error };
  };

  const saveBookingPermissions = async (customerId: string, permissions: Partial<BookingPermissions>) => {
    const { error } = await supabase.from('profiles').update(permissions).eq('id', customerId);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...permissions } : c));
    return { error };
  };

  const saveCustomerProfile = async (customerId: string, fields: Partial<Pick<CustomerProfile, 'player_type' | 'parent_name' | 'location' | 'birth_date' | 'phone' | 'address'>>) => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', customerId);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...fields } : c));
    return { error };
  };

  return {
    customers, allAppointments, trainers, loading, loadError,
    cancelAppointment, addAppointmentForCustomer,
    createCustomer, deleteCustomer,
    saveCustomerLevel, saveBookingPermissions, saveCustomerProfile,
    reload: load,
  };
}
