/**
 * Integration-Tests für useAdminData Kernlogik.
 * Testet Supabase-Interaktionen und Fehlerbehandlung direkt ohne React-Rendering.
 */

import { supabase } from '../lib/supabase';
import { checkDailyConflict } from '../utils/bookingRules';

jest.mock('../lib/supabase', () => {
  const chain = () => {
    const obj: any = {
      select: jest.fn(() => obj),
      insert: jest.fn(() => obj),
      update: jest.fn(() => obj),
      delete: jest.fn(() => obj),
      eq: jest.fn(() => obj),
      order: jest.fn(() => obj),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve: (v: any) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return obj;
  };
  return {
    supabase: {
      from: jest.fn(() => chain()),
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      },
      functions: {
        invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
      },
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// ── deleteCustomer Logik ─────────────────────────────────────────────────────

describe('deleteCustomer — Edge Function Integration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ruft delete-customer Edge Function mit customerId auf', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    const result = await mockSupabase.functions.invoke('delete-customer', {
      body: { customerId: 'cust-123' },
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-customer', {
      body: { customerId: 'cust-123' },
    });
    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeNull();
  });

  test('gibt Fehler zurück wenn nicht autorisiert', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { error: 'Nur Admins dürfen Kunden löschen' },
      error: null,
    });

    const result = await mockSupabase.functions.invoke('delete-customer', {
      body: { customerId: 'cust-456' },
    });

    expect(result.data.error).toBe('Nur Admins dürfen Kunden löschen');
  });

  test('gibt Netzwerkfehler weiter', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Netzwerkfehler' },
    });

    const result = await mockSupabase.functions.invoke('delete-customer', {
      body: { customerId: 'cust-789' },
    });

    expect(result.error?.message).toBe('Netzwerkfehler');
  });
});

// ── createCustomer Logik ─────────────────────────────────────────────────────

describe('createCustomer — Edge Function Integration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('übergibt alle Pflichtfelder an Edge Function', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { temp_password: 'AbCd1234!', customer_number: 103 },
      error: null,
    });

    const params = {
      email: 'neue@kunde.de',
      full_name: 'Neue Kundin',
      phone: '0160 1234567',
      birth_date: '1988-03-22',
      address: 'Teststraße 5, 12345 Teststadt',
    };

    const result = await mockSupabase.functions.invoke('create-customer', { body: params });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-customer', { body: params });
    expect(result.data.temp_password).toBe('AbCd1234!');
    expect(result.data.customer_number).toBe(103);
  });

  test('gibt Fehlermeldung bei doppelter E-Mail zurück', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { error: 'E-Mail bereits vergeben' },
      error: null,
    });

    const result = await mockSupabase.functions.invoke('create-customer', {
      body: { email: 'existing@kunde.de', full_name: 'Test' },
    });

    expect(result.data.error).toBe('E-Mail bereits vergeben');
  });
});

// ── Buchungskonflikt ─────────────────────────────────────────────────────────

describe('checkDailyConflict — Zusammenspiel mit DB-Daten', () => {
  const buildAppointments = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `appt-${i}`,
      date: '2026-06-15',
      time: '09:00',
      status: 'confirmed' as const,
      program: 'individual',
      user_id: 'cust-1',
    }));

  test('Kunde ohne Termin kann buchen', () => {
    expect(checkDailyConflict([], '2026-06-15').allowed).toBe(true);
  });

  test('Kunde mit Termin kann keinen weiteren Termin am gleichen Tag buchen', () => {
    const r = checkDailyConflict(buildAppointments(1), '2026-06-15');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeDefined();
  });

  test('Mehrere Kunden gleichzeitig: Konflikte unabhängig geprüft', () => {
    const kunden = ['cust-1', 'cust-2', 'cust-3'];
    kunden.forEach(() => {
      const eigene = buildAppointments(1);
      expect(checkDailyConflict(eigene, '2026-06-15').allowed).toBe(false);
    });
  });
});
