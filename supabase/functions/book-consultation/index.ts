import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://pmzdev.de', 'https://www.pmzdev.de'];

function corsHeaders(origin: string | null) {
  const allowed = ALLOWED_ORIGINS.includes(origin ?? '') ? origin! : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey' };
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function germanHolidays(year: number): Set<string> {
  const e = easterDate(year);
  const add = (dt: Date, n: number) => { const r = new Date(dt); r.setDate(r.getDate() + n); return r; };
  const s = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  return new Set([
    `${year}-01-01`, s(add(e, -2)), s(add(e, 1)), `${year}-05-01`,
    s(add(e, 39)), s(add(e, 50)), `${year}-10-03`, `${year}-12-25`, `${year}-12-26`,
  ]);
}

function isBookableDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (germanHolidays(d.getFullYear()).has(dateStr)) return false;
  return true;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const { name, email, phone, date, time, message } = await req.json();

    if (!name?.trim()) return json({ error: 'Name ist erforderlich.' }, 400);
    if (!email?.trim()) return json({ error: 'E-Mail ist erforderlich.' }, 400);
    if (!date?.match(/^\d{4}-\d{2}-\d{2}$/)) return json({ error: 'Ungültiges Datum.' }, 400);
    if (!time?.match(/^\d{2}:\d{2}$/)) return json({ error: 'Ungültige Uhrzeit.' }, 400);

    const today = new Date().toISOString().split('T')[0];
    if (date < today) return json({ error: 'Datum liegt in der Vergangenheit.' }, 400);
    if (!isBookableDay(date)) return json({ error: 'An diesem Tag sind keine Beratungstermine möglich (Wochenende oder Feiertag).' }, 400);

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Slot-Kapazität prüfen: max. 2 Buchungen (Termine + Beratungsanfragen)
    const [{ data: appts }, { data: consultations }] = await Promise.all([
      client.from('appointments').select('id').eq('date', date).eq('time', time).eq('status', 'confirmed'),
      client.from('consultation_requests').select('id').eq('date', date).eq('time', time).eq('status', 'confirmed'),
    ]);

    const total = (appts?.length ?? 0) + (consultations?.length ?? 0);
    if (total >= 2) {
      return json({ error: 'Dieser Zeitslot ist leider bereits ausgebucht. Bitte wähle einen anderen Termin.' }, 409);
    }

    const { error } = await client.from('consultation_requests').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() ?? null,
      date,
      time,
      message: message?.trim() ?? null,
      status: 'pending',
    });

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, message: 'Deine Anfrage wurde erfolgreich übermittelt. Wir melden uns in Kürze.' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
