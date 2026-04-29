import { createClient } from 'npm:@supabase/supabase-js';
import nodemailer from 'npm:nodemailer';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: Deno.env.get('GMAIL_USER'),
    pass: Deno.env.get('GMAIL_PASS'),
  },
});

Deno.serve(async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: appointments } = await supabase
    .from('appointments')
    .select('user_id, date, time')
    .eq('date', tomorrowStr)
    .eq('status', 'confirmed');

  if (!appointments?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  for (const appt of appointments) {
    const { data: { user } } = await supabase.auth.admin.getUserById(appt.user_id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', appt.user_id)
      .single();

    if (!user?.email) continue;

    await transporter.sendMail({
      from: `"PK Fußballschule" <${Deno.env.get('GMAIL_USER')}>`,
      to: user.email,
      subject: '⏰ Erinnerung – Dein Training morgen',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#3a7a52">Hallo ${profile?.full_name ?? ''},</h2>
          <p>wir möchten dich an dein Training <strong>morgen</strong> erinnern.</p>
          <table style="background:#f5f5f5;border-radius:10px;padding:16px 24px;width:100%">
            <tr><td style="color:#666;padding:6px 0">Datum</td><td><strong>${appt.date}</strong></td></tr>
            <tr><td style="color:#666;padding:6px 0">Uhrzeit</td><td><strong>${appt.time} Uhr</strong></td></tr>
          </table>
          <p style="color:#888;font-size:14px;margin-top:24px">Bis morgen!<br>Dein PK Fußballschule Team</p>
        </div>
      `,
    });
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
