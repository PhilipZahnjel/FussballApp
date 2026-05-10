import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

async function call(name: string, body: object): Promise<void> {
  if (!FUNCTIONS_URL) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTIONS_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn(`E-Mail "${name}" fehlgeschlagen:`, res.status, await res.text());
  } catch (e) {
    console.warn(`E-Mail "${name}" nicht erreichbar:`, e);
  }
}

type BookingEmailData = { email: string; name: string; date: string; time: string; program: string };

export const EmailService = {
  sendBooking: (data: BookingEmailData) => call('send-booking-email', data),
  sendCancellation: (data: BookingEmailData) => call('send-cancellation-email', data),
};
