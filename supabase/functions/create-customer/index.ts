import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  };
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Aufrufenden Admin verifizieren
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Nicht autorisiert' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Nicht autorisiert' }, 401);

    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Nur Admins dürfen Kunden anlegen' }, 403);
    }

    const { email, full_name, phone, birth_date, address } = await req.json();
    if (!email?.trim() || !full_name?.trim()) {
      return json({ error: 'E-Mail und Name sind Pflichtfelder' }, 400);
    }

    const tempPassword = generateTempPassword();

    // Auth-User anlegen
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      return json({ error: authError?.message ?? 'Fehler beim Anlegen des Nutzers' }, 500);
    }

    // Profil anlegen (Trigger vergibt Kundennummer automatisch)
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: full_name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        birth_date: birth_date?.trim() || null,
        address: address?.trim() || null,
        role: 'customer',
        is_active: true,
      })
      .select('customer_number')
      .single();

    if (profileError) {
      // Auth-User zurückrollen falls Profil fehlschlägt
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      return json({ error: profileError.message }, 500);
    }

    return json({ temp_password: tempPassword, customer_number: profile.customer_number });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
