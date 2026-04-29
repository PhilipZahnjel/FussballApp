import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditBalance } from '../types';

export type CustomerCredits = CreditBalance & {
  subscription_name: string | null;
  lymph_discount: boolean;
  loading: boolean;
};

export function useCredits(): CustomerCredits {
  const [emsBalance, setEmsBalance] = useState(0);
  const [lymphBalance, setLymphBalance] = useState(0);
  const [subscriptionName, setSubscriptionName] = useState<string | null>(null);
  const [lymphDiscount, setLymphDiscount] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) { setLoading(false); return; }

      const [emsRes, lymphRes, subRes, profileRes] = await Promise.all([
        supabase.from('credit_transactions').select('amount').eq('user_id', user.id).eq('type', 'ems'),
        supabase.from('credit_transactions').select('amount').eq('user_id', user.id).eq('type', 'lymph'),
        supabase.from('customer_subscriptions').select('plan:subscription_plans(name)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('lymph_discount').eq('id', user.id).single(),
      ]);

      if (!isMounted) return;
      setEmsBalance((emsRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0));
      setLymphBalance((lymphRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0));
      setSubscriptionName((subRes.data as any)?.plan?.name ?? null);
      setLymphDiscount(profileRes.data?.lymph_discount ?? false);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('credits-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'credit_transactions' }, () => load())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { ems_balance: emsBalance, lymph_balance: lymphBalance, subscription_name: subscriptionName, lymph_discount: lymphDiscount, loading };
}
