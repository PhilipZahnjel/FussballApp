import { useState, useEffect } from 'react';
import { PlayerLevel, PlayerType, BookingPermissions, TrainerSchedule, TrainerSpecialty } from '../../types';
import { AppointmentService } from '../../services/appointmentService';
import { ProfileService } from '../../services/profileService';
import { TokenService } from '../../services/tokenService';
import { TrainerScheduleService } from '../../services/trainerScheduleService';
import { CustomerService, CreateCustomerParams } from '../services/customerService';
import { PROGRAM_CATEGORY, ProgramId } from '../../constants/programs';

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
  trainer_specialty?: TrainerSpecialty | null;
};

export function useAdminData() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [allAppointments, setAllAppointments] = useState<AdminAppointment[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [trainerSchedules, setTrainerSchedules] = useState<TrainerSchedule[]>([]);
  const [activeTokensByCustomer, setActiveTokensByCustomer] = useState<Record<string, { individual: number; gruppe: number }>>({});
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
      { data: allTokens },
      { data: schedules },
    ] = await Promise.all([
      ProfileService.fetchAllCustomers(),
      AppointmentService.fetchAllDesc(),
      ProfileService.fetchTrainers(),
      TokenService.fetchAllActive(),
      TrainerScheduleService.fetchAll(),
    ]);
    if (profilesErr || apptsErr) {
      setLoadError(profilesErr?.message ?? apptsErr?.message ?? 'Fehler beim Laden.');
    }
    setCustomers((profiles ?? []) as CustomerProfile[]);
    setAllAppointments((appointments ?? []) as AdminAppointment[]);
    setTrainers((trainerProfiles ?? []) as TrainerProfile[]);
    setTrainerSchedules((schedules ?? []) as TrainerSchedule[]);

    const tokenMap: Record<string, { individual: number; gruppe: number }> = {};
    for (const token of (allTokens ?? []) as { user_id: string; category: string }[]) {
      if (!tokenMap[token.user_id]) tokenMap[token.user_id] = { individual: 0, gruppe: 0 };
      if (token.category === 'individual') tokenMap[token.user_id].individual++;
      else if (token.category === 'gruppe') tokenMap[token.user_id].gruppe++;
    }
    setActiveTokensByCustomer(tokenMap);

    setLoading(false);
  };

  const cancelAppointment = async (id: string) => {
    const appt = allAppointments.find(a => a.id === id);
    const { error } = await AppointmentService.updateStatus(id, 'cancelled');
    if (!error && appt) {
      const category = PROGRAM_CATEGORY[appt.program as ProgramId] ?? 'individual';
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await TokenService.insert({
        user_id: appt.user_id,
        category,
        expires_at: expiresAt.toISOString(),
        source_appointment_id: id,
      });
      setAllAppointments(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a,
      ));
      setActiveTokensByCustomer(prev => ({
        ...prev,
        [appt.user_id]: {
          individual: (prev[appt.user_id]?.individual ?? 0) + (category === 'individual' ? 1 : 0),
          gruppe: (prev[appt.user_id]?.gruppe ?? 0) + (category === 'gruppe' ? 1 : 0),
        },
      }));
    }
    return { error };
  };

  const addAppointmentForCustomer = async (
    userId: string, date: string, time: string, program: string,
    trainerId?: string | null,
    sessionBirthYear?: number | null,
    sessionLevel?: string | null,
  ) => {
    const { data: conflicts } = await AppointmentService.checkDailyConflict(userId, date);
    if (conflicts && conflicts.length > 0) {
      return { error: { message: 'Der Kunde hat an diesem Tag bereits einen Termin.' } };
    }

    const { data, error } = await AppointmentService.insert({
      user_id: userId, date, time, status: 'confirmed', program,
      ...(trainerId ? { trainer_id: trainerId } : {}),
      ...(sessionBirthYear != null ? { session_birth_year: sessionBirthYear } : {}),
      ...(sessionLevel ? { session_level: sessionLevel } : {}),
    });

    if (data && !error) {
      setAllAppointments(prev => [...prev, data as AdminAppointment]);
    }
    return { error };
  };

  const createCustomer = async (
    params: CreateCustomerParams,
  ): Promise<{ error: string | null; tempPassword?: string; customerNumber?: number }> => {
    try {
      const { data, error } = await CustomerService.create(params);
      if (error) {
        const body = (error as any).context;
        const msg = body && typeof body === 'object' && 'error' in body
          ? String(body.error)
          : error.message ?? JSON.stringify(error);
        return { error: msg };
      }
      if (data?.error) return { error: data.error as string };
      await load();
      return { error: null, tempPassword: data.temp_password, customerNumber: data.customer_number };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  };

  const deleteCustomer = async (customerId: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await CustomerService.delete(customerId);
      if (error) {
        const body = (error as any).context;
        const msg = body && typeof body === 'object' && 'error' in body
          ? String(body.error)
          : error.message ?? JSON.stringify(error);
        return { error: msg };
      }
      if (data?.error) return { error: data.error as string };
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setAllAppointments(prev => prev.filter(a => a.user_id !== customerId));
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  };

  const saveCustomerLevel = async (customerId: string, level: PlayerLevel | null) => {
    const { error } = await ProfileService.update(customerId, { level });
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, level } : c));
    return { error };
  };

  const saveBookingPermissions = async (customerId: string, permissions: Partial<BookingPermissions>) => {
    const { error } = await ProfileService.update(customerId, permissions as Record<string, unknown>);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...permissions } : c));
    return { error };
  };

  const saveCustomerProfile = async (
    customerId: string,
    fields: Partial<Pick<CustomerProfile, 'player_type' | 'parent_name' | 'location' | 'birth_date' | 'phone' | 'address'>>,
  ) => {
    const { error } = await ProfileService.update(customerId, fields as Record<string, unknown>);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...fields } : c));
    return { error };
  };

  const toggleScheduleSlot = async (trainerId: string, day: number, time: string) => {
    const exists = trainerSchedules.some(
      s => s.trainer_id === trainerId && s.day_of_week === day && s.time === time,
    );
    if (exists) {
      const { error } = await TrainerScheduleService.deleteEntry(trainerId, day, time);
      if (!error) {
        setTrainerSchedules(prev =>
          prev.filter(s => !(s.trainer_id === trainerId && s.day_of_week === day && s.time === time)),
        );
      }
      return { error };
    } else {
      const { data, error } = await TrainerScheduleService.upsert({ trainer_id: trainerId, day_of_week: day, time });
      if (!error && data) {
        setTrainerSchedules(prev => [...prev, data as TrainerSchedule]);
      } else if (!error) {
        await load();
      }
      return { error };
    }
  };

  const createTrainer = async (params: {
    full_name: string;
    email: string;
    specialty: TrainerSpecialty;
  }): Promise<{ error: string | null; tempPassword?: string }> => {
    try {
      const { data, error } = await CustomerService.create({
        full_name: params.full_name,
        email: params.email,
        phone: '',
        birth_date: '',
        address: '',
        parent_name: '',
        player_type: null,
        location: '',
        role: 'trainer',
        trainer_specialty: params.specialty,
      });
      if (error) {
        const body = (error as any).context;
        const msg = body && typeof body === 'object' && 'error' in body
          ? String(body.error)
          : (error as any).message ?? JSON.stringify(error);
        return { error: msg };
      }
      if (data?.error) return { error: data.error as string };
      await load();
      return { error: null, tempPassword: data.temp_password };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  };

  return {
    customers, allAppointments, trainers, trainerSchedules, activeTokensByCustomer, loading, loadError,
    cancelAppointment, addAppointmentForCustomer,
    createCustomer, deleteCustomer,
    saveCustomerLevel, saveBookingPermissions, saveCustomerProfile,
    toggleScheduleSlot, createTrainer,
    reload: load,
  };
}
