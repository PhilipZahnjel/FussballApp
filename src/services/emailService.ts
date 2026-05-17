import { supabase } from '../lib/supabase';

type BookingEmailData = { email: string; name: string; date: string; time: string; program: string };

async function call(name: string, body: BookingEmailData): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke(name, { body });
    if (error) console.warn(`E-Mail "${name}" fehlgeschlagen:`, error.message);
  } catch (e) {
    console.warn(`E-Mail "${name}" nicht erreichbar:`, e);
  }
}

export const EmailService = {
  sendBooking: (data: BookingEmailData) => call('send-booking-email', data),
  sendCancellation: (data: BookingEmailData) => call('send-cancellation-email', data),
};
