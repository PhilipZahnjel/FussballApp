import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SubscriptionPlan, CustomerSubscription, CreditBalance, Measurement } from '../../types';

export type CustomerProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  birth_date: string | null;
  address: string | null;
  customer_number: number;
  is_active: boolean;
  iban: string | null;
  bic: string | null;
  account_holder: string | null;
  bank_name: string | null;
  mandate_reference: string | null;
  mandate_date: string | null;
  role: string;
  lymph_discount: boolean;
};

export type AdminAppointment = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled';
  program: string;
};

export type ConsultationRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  date: string;
  time: string;
  message: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
};

export type PendingCharge = {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  period: string;
  status: string;
};

export function useAdminData() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [allAppointments, setAllAppointments] = useState<AdminAppointment[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [consultationRequests, setConsultationRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [
      { data: profiles, error: profilesErr },
      { data: appointments, error: apptsErr },
      { data: plans, error: plansErr },
      { data: consultations },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'customer').order('full_name'),
      supabase.from('appointments').select('*').order('date', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('name'),
      supabase.from('consultation_requests').select('*').order('date', { ascending: true }),
    ]);
    if (profilesErr || apptsErr || plansErr) {
      setLoadError(profilesErr?.message ?? apptsErr?.message ?? plansErr?.message ?? 'Fehler beim Laden.');
    }
    setCustomers((profiles ?? []) as CustomerProfile[]);
    setAllAppointments((appointments ?? []) as AdminAppointment[]);
    setSubscriptionPlans((plans ?? []) as SubscriptionPlan[]);
    setConsultationRequests((consultations ?? []) as ConsultationRequest[]);
    setLoading(false);
  };

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      setAllAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a));
      // Guthaben erstatten wenn Termin ein Kredit-Termin war
      const { data: creditTx } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('appointment_id', id)
        .maybeSingle();
      if (creditTx) {
        await supabase.from('credit_transactions').insert({
          user_id: creditTx.user_id,
          type: creditTx.type,
          amount: 1,
          reason: 'cancellation',
          appointment_id: id,
        });
        if (creditTx.reason === 'extra_booking') {
          const appt = allAppointments.find(a => a.id === id);
          if (appt) {
            const typeLabel = creditTx.type === 'lymph' ? 'Lymphdrainage' : 'EMS';
            await supabase.from('charges').delete()
              .eq('user_id', creditTx.user_id)
              .eq('status', 'pending')
              .eq('description', `Extra ${typeLabel}-Termin ${appt.date}`);
          }
        }
      }
    }
    return { error };
  };

  const addAppointmentForCustomer = async (userId: string, date: string, time: string, program: string) => {
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id, program')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('status', 'confirmed');

    if (conflicts && conflicts.length > 0) {
      const isLymphException = program === 'lymph' || conflicts.some((a: any) => a.program === 'lymph');
      if (!isLymphException) {
        return { error: { message: 'Der Kunde hat an diesem Tag bereits einen Termin. Ausnahme gilt nur für Lymphdrainage.' } };
      }
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({ user_id: userId, date, time, status: 'confirmed', program })
      .select('id, date, time, status, program, user_id')
      .single();

    if (data && !error) {
      setAllAppointments(prev => [...prev, data as AdminAppointment]);
      await _handleCreditDeduction(userId, program, date, data.id);
    }
    return { error };
  };

  // Intern: Guthaben abziehen und ggf. Extra-Charge anlegen
  const _handleCreditDeduction = async (userId: string, program: string, date: string, appointmentId: string) => {
    const creditType = program === 'lymph' ? 'lymph' : 'ems';

    const { data: creditData } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', creditType);
    const balance = (creditData ?? []).reduce((sum: number, t: any) => sum + t.amount, 0);

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

      const plan = (sub as any)?.plan as SubscriptionPlan | undefined;
      let extraPrice = creditType === 'lymph'
        ? (plan?.extra_lymph_price ?? 25)
        : (plan?.extra_ems_price ?? 25);

      if (creditType === 'lymph') {
        const customer = customers.find(c => c.id === userId);
        if (customer?.lymph_discount && plan?.discounted_lymph_price != null) {
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
  };

  const saveBankDetails = async (customerId: string, data: { iban: string; bic: string; account_holder: string; bank_name: string }) => {
    const { error } = await supabase.from('profiles').update(data).eq('id', customerId);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...data } : c));
    return { error };
  };

  const saveMandate = async (customerId: string, mandateReference: string, mandateDate: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ mandate_reference: mandateReference, mandate_date: mandateDate })
      .eq('id', customerId);
    if (!error) {
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, mandate_reference: mandateReference, mandate_date: mandateDate } : c
      ));
    }
    return { error };
  };

  const saveLymphDiscount = async (customerId: string, discount: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ lymph_discount: discount })
      .eq('id', customerId);
    if (!error) setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, lymph_discount: discount } : c));
    return { error };
  };

  const addCharge = async (userId: string, amount: number, description: string, period: string) => {
    const { data, error } = await supabase
      .from('charges')
      .insert({ user_id: userId, amount, description, period, status: 'pending' })
      .select()
      .single();
    return { data, error };
  };

  const createCustomer = async (params: {
    email: string;
    full_name: string;
    phone: string;
    birth_date: string;
    address: string;
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

  // Abo-Pläne verwalten
  const createPlan = async (plan: Omit<SubscriptionPlan, 'id' | 'is_active'>) => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert({ ...plan, is_active: true })
      .select()
      .single();
    if (data) setSubscriptionPlans(prev => [...prev, data as SubscriptionPlan]);
    return { data, error };
  };

  const updatePlan = async (id: string, updates: Partial<SubscriptionPlan>) => {
    const { error } = await supabase.from('subscription_plans').update(updates).eq('id', id);
    if (!error) setSubscriptionPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    return { error };
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (!error) setSubscriptionPlans(prev => prev.filter(p => p.id !== id));
    return { error };
  };

  // Abonnement einem Kunden zuweisen
  const assignSubscription = async (userId: string, planId: string, startDate: string) => {
    await supabase.from('customer_subscriptions').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    const { data, error } = await supabase
      .from('customer_subscriptions')
      .insert({ user_id: userId, plan_id: planId, start_date: startDate, is_active: true })
      .select('*, plan:subscription_plans(*)')
      .single();
    return { data: data as CustomerSubscription | null, error };
  };

  const removeSubscription = async (subscriptionId: string) => {
    const { error } = await supabase
      .from('customer_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId);
    return { error };
  };

  // Guthaben und Abo-Details eines Kunden laden
  const getCustomerDetails = async (userId: string): Promise<{
    subscription: CustomerSubscription | null;
    credits: CreditBalance;
  }> => {
    const [subRes, emsRes, lymphRes] = await Promise.all([
      supabase.from('customer_subscriptions').select('*, plan:subscription_plans(*)').eq('user_id', userId).eq('is_active', true).maybeSingle(),
      supabase.from('credit_transactions').select('amount').eq('user_id', userId).eq('type', 'ems'),
      supabase.from('credit_transactions').select('amount').eq('user_id', userId).eq('type', 'lymph'),
    ]);
    return {
      subscription: subRes.data as CustomerSubscription | null,
      credits: {
        ems_balance: (emsRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0),
        lymph_balance: (lymphRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0),
      },
    };
  };

  // Monatliche Abrechnung: Abo-Gutschriften und Charges anlegen
  const runMonthlyBilling = async (period: string): Promise<{ billed: number; skipped: number; error: string | null }> => {
    const { data: subs, error: subsError } = await supabase
      .from('customer_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('is_active', true);

    if (subsError) return { billed: 0, skipped: 0, error: subsError.message };

    let billed = 0;
    let skipped = 0;

    for (const sub of (subs ?? [])) {
      // Doppelte Abrechnung verhindern
      const { data: existing } = await supabase
        .from('charges')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('period', period)
        .like('description', 'Abo:%')
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const plan = (sub as any).plan as SubscriptionPlan;

      await supabase.from('charges').insert({
        user_id: sub.user_id,
        amount: plan.monthly_price,
        description: `Abo: ${plan.name} ${period}`,
        period,
        status: 'pending',
      });

      if (plan.ems_credits_per_month > 0) {
        await supabase.from('credit_transactions').insert({
          user_id: sub.user_id,
          type: 'ems',
          amount: plan.ems_credits_per_month,
          reason: 'subscription',
        });
      }
      if (plan.lymph_credits_per_month > 0) {
        await supabase.from('credit_transactions').insert({
          user_id: sub.user_id,
          type: 'lymph',
          amount: plan.lymph_credits_per_month,
          reason: 'subscription',
        });
      }

      billed++;
    }

    return { billed, skipped, error: null };
  };

  // Messungen
  const getMeasurements = async (userId: string): Promise<{ data: Measurement[]; error: any }> => {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false });
    return { data: (data ?? []) as Measurement[], error };
  };

  const addMeasurement = async (userId: string, fields: Partial<Omit<Measurement, 'id'>>): Promise<{ error: any }> => {
    const { error } = await supabase.from('measurements').insert({ user_id: userId, ...fields });
    return { error };
  };

  // Beratungsanfragen verwalten
  const updateConsultationStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    const { error } = await supabase.from('consultation_requests').update({ status }).eq('id', id);
    if (!error) setConsultationRequests(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    return { error };
  };

  // Guthaben manuell hinzufügen oder abziehen
  const addManualCredit = async (userId: string, type: 'ems' | 'lymph', amount: number) => {
    const { error } = await supabase.from('credit_transactions').insert({
      user_id: userId,
      type,
      amount,
      reason: 'manual',
    });
    return { error };
  };

  // Offene Charges für einen Zeitraum laden
  const getPendingCharges = async (period: string): Promise<{ data: PendingCharge[]; error: any }> => {
    const { data, error } = await supabase
      .from('charges')
      .select('*')
      .eq('period', period)
      .eq('status', 'pending');
    return { data: (data ?? []) as PendingCharge[], error };
  };

  return {
    customers, allAppointments, subscriptionPlans, consultationRequests, loading, loadError,
    updateConsultationStatus,
    cancelAppointment, addAppointmentForCustomer,
    saveMandate, saveBankDetails, saveLymphDiscount, addCharge,
    createCustomer, deleteCustomer,
    createPlan, updatePlan, deletePlan,
    assignSubscription, removeSubscription, getCustomerDetails,
    addManualCredit, runMonthlyBilling, getPendingCharges,
    getMeasurements, addMeasurement,
    reload: load,
  };
}
