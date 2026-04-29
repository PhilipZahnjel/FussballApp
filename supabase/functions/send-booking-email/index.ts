import nodemailer from 'npm:nodemailer';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey' };
}

const PROGRAM_NAMES: Record<string, string> = {
  individual:           'Individualtraining',
  gruppe:               'Gruppentraining',
  athletik:             'Athletiktraining',
  torhueter_individual: 'Torwart Individual',
  torhueter_gruppe:     'Torwart Gruppe',
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: Deno.env.get('GMAIL_USER'),
    pass: Deno.env.get('GMAIL_PASS'),
  },
});

Deno.serve(async (req) => {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const { email, name, date, time, program } = await req.json();
  const programName = PROGRAM_NAMES[program] ?? 'Training';

  const safeName = (name ?? '').replace(/[<>]/g, '').slice(0, 100);
  const safeDate = (date ?? '').replace(/[^0-9\-.]/g, '');
  const safeTime = (time ?? '').replace(/[^0-9:]/g, '');

  await transporter.sendMail({
    from: `"PK Fußballschule" <${Deno.env.get('GMAIL_USER')}>`,
    to: email,
    subject: `✅ Buchungsbestätigung – ${programName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#3a7a52">Hallo ${safeName},</h2>
        <p>deine Trainingseinheit wurde erfolgreich gebucht.</p>
        <table style="background:#f5f5f5;border-radius:10px;padding:16px 24px;width:100%">
          <tr><td style="color:#666;padding:6px 0">Leistung</td><td><strong>${programName}</strong></td></tr>
          <tr><td style="color:#666;padding:6px 0">Datum</td><td><strong>${safeDate}</strong></td></tr>
          <tr><td style="color:#666;padding:6px 0">Uhrzeit</td><td><strong>${safeTime} Uhr</strong></td></tr>
        </table>
        <p style="color:#888;font-size:14px;margin-top:24px">Wir freuen uns auf dich!<br>Dein PK Fußballschule Team</p>
      </div>
    `,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
