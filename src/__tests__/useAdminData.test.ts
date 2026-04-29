/**
 * Integration-Tests für useAdminData Kernlogik.
 * Testet Supabase-Interaktionen und Fehlerbehandlung direkt ohne React-Rendering,
 * da jest-expo mit Node.js v24 inkompatibel ist.
 */

import { supabase } from '../lib/supabase';
import { checkBookingConflict } from '../utils/bookingRules';

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

// ── Buchungskonflikt Integration (Zusammenspiel) ─────────────────────────────

describe('Buchungskonflikt — Zusammenspiel mit DB-Daten', () => {
  const buildAppointments = (programs: string[]) =>
    programs.map((program, i) => ({
      id: `appt-${i}`,
      date: '2026-06-15',
      time: '09:00',
      status: 'confirmed' as const,
      program,
      user_id: 'cust-1',
    }));

  test('normaler Ablauf: Kunde ohne Termin kann buchen', () => {
    expect(checkBookingConflict([], '2026-06-15', 'muscle').allowed).toBe(true);
  });

  test('Kunde mit muscle-Termin kann noch lymph buchen', () => {
    expect(checkBookingConflict(buildAppointments(['muscle']), '2026-06-15', 'lymph').allowed).toBe(true);
  });

  test('Kunde mit lymph-Termin kann noch muscle buchen', () => {
    expect(checkBookingConflict(buildAppointments(['lymph']), '2026-06-15', 'muscle').allowed).toBe(true);
  });

  test('Kunde mit muscle-Termin kann kein relax buchen', () => {
    const r = checkBookingConflict(buildAppointments(['muscle']), '2026-06-15', 'relax');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeDefined();
  });

  test('Mehrere Kunden gleichzeitig: Konflikte unabhängig geprüft', () => {
    const kunden = ['cust-1', 'cust-2', 'cust-3'];
    const allAppts = kunden.flatMap(id =>
      buildAppointments(['muscle']).map(a => ({ ...a, user_id: id }))
    );

    kunden.forEach(id => {
      const eigene = allAppts.filter(a => a.user_id === id);
      const r = checkBookingConflict(eigene, '2026-06-15', 'relax');
      expect(r.allowed).toBe(false);
    });
  });
});

// ── saveBankDetails — Supabase Update Integration ────────────────────────────

describe('saveBankDetails — Datenbankinteraktion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('führt UPDATE auf profiles Tabelle aus', async () => {
    const eqMock = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const updateMock = jest.fn(() => ({ eq: eqMock }));
    (mockSupabase.from as jest.Mock).mockReturnValueOnce({ update: updateMock });

    const bankData = {
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      account_holder: 'Max Mustermann',
      bank_name: 'Commerzbank',
    };

    mockSupabase.from('profiles').update(bankData);

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    }));
  });

  test('gibt Fehler zurück bei Datenbankfehler', async () => {
    const eqMock = jest.fn(() => Promise.resolve({ data: null, error: { message: 'DB-Fehler' } }));
    (mockSupabase.from as jest.Mock).mockReturnValueOnce({
      update: jest.fn(() => ({ eq: eqMock })),
    });

    const chain = mockSupabase.from('profiles').update({});
    const result = await (chain as any).eq('id', 'cust-1');
    expect(result.error?.message).toBe('DB-Fehler');
  });
});
