import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROGRAM_CATEGORY: Record<string, string> = {
  individual: 'individual',
  gruppe: 'gruppe',
  athletik: 'gruppe',
  torhueter_individual: 'individual',
  torhueter_gruppe: 'gruppe',
};

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey' };
}

Deno.serve(async (req) => {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
      .from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') return json({ error: 'Nur Admins dürfen Trainer löschen' }, 403);

    const { trainer_id } = await req.json();
    if (!trainer_id) return json({ error: 'trainer_id fehlt' }, 400);

    // Safety-Check: nur role='trainer' darf gelöscht werden
    const { data: trainerProfile } = await serviceClient
      .from('profiles').select('role').eq('id', trainer_id).single();
    if (!trainerProfile || trainerProfile.role !== 'trainer') {
      return json({ error: 'Nur Trainer-Accounts können gelöscht werden.' }, 400);
    }

    // 1. Alle bestätigten Termine dieses Trainers laden
    const { data: appointments } = await serviceClient
      .from('appointments')
      .select('id, user_id, program')
      .eq('trainer_id', trainer_id)
      .eq('status', 'confirmed');

    if (appointments && appointments.length > 0) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // 2. Nachholtermin-Tokens für betroffene Kunden ausstellen
      await serviceClient.from('cancellation_tokens').insert(
        appointments.map((a: any) => ({
          user_id: a.user_id,
          category: PROGRAM_CATEGORY[a.program] ?? 'individual',
          expires_at: expiresAt.toISOString(),
          source_appointment_id: a.id,
        })),
      );

      // 3. Termine stornieren
      await serviceClient
        .from('appointments')
        .update({ status: 'cancelled' })
        .in('id', appointments.map((a: any) => a.id));
    }

    // 4. Notifications bereinigen falls Trainer dort referenziert ist
    await serviceClient.from('notifications').update({ created_by: null }).eq('created_by', trainer_id);

    // 5. Auth-User löschen (cascades zu profiles; ON DELETE SET NULL auf appointments.trainer_id)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(trainer_id);
    if (deleteError) {
      const notFound = deleteError.status === 404 || deleteError.message?.toLowerCase().includes('not found');
      if (!notFound) return json({ error: deleteError.message }, 500);
      await serviceClient.from('profiles').delete().eq('id', trainer_id);
    }

    return json({ ok: true, cancelled_count: appointments?.length ?? 0 });
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
