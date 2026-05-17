import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useAppointments } from '../hooks/useAppointments';
import { supabase } from '../lib/supabase';
import type { Profile } from '../hooks/useProfile';

const mockUnsubscribe = jest.fn();
const mockChannelObj = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };

const baseProfile: Profile = {
  full_name: 'Max Mustermann',
  phone: '0170123',
  customer_number: 101,
  is_active: true,
  email: 'max@example.com',
  birth_date: '2000-01-01',
  address: null,
  parent_name: null,
  location: 'München',
  player_type: 'feldspieler',
  role: 'customer',
  level: 'amateur',
  can_book_individual: true,
  can_book_gruppe: true,
  can_book_athletik: false,
  can_book_torhueter_individual: false,
  can_book_torhueter_gruppe: false,
  quota_individual: 2,
  quota_gruppe: 2,
};

const mockAppt = {
  id: 'appt-1',
  user_id: 'user-1',
  date: '2024-06-10',
  time: '10:00',
  status: 'confirmed' as const,
  program: 'individual',
  created_at: '2024-06-01T08:00:00Z',
};

const mockToken = {
  id: 'tok-1',
  user_id: 'user-1',
  category: 'individual',
  issued_at: '2024-06-01T00:00:00Z',
  expires_at: '2099-07-01T00:00:00Z',
  used_at: null,
  source_appointment_id: 'appt-old',
};

function makeFromChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((cb: (v: any) => any) => Promise.resolve(cb({ data: [], error: null }))),
    ...overrides,
  };
  return chain;
}

function captureAuthCallback(): (event: string, session: any) => void {
  let captured: (event: string, session: any) => void = () => {};
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb: any) => {
    captured = cb;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  });
  return (...args: Parameters<typeof captured>) => captured(...args);
}

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.channel as jest.Mock).mockReturnValue(mockChannelObj);
  (supabase.removeChannel as jest.Mock).mockResolvedValue(undefined);
  (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  (supabase.auth as any).getSession = jest.fn().mockResolvedValue({
    data: { session: { user: { id: 'user-1', email: 'max@example.com' } } },
  });
});

describe('useAppointments – initial state', () => {
  it('returns empty lists and loading=true', () => {
    const { result } = renderHook(() => useAppointments(null));
    expect(result.current.appointments).toEqual([]);
    expect(result.current.myAppointments).toEqual([]);
    expect(result.current.activeTokens).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});

describe('useAppointments – no session', () => {
  it('sets loading false with empty state when no user', async () => {
    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useAppointments(null));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', null);
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.appointments).toEqual([]);
  });
});

describe('useAppointments – loads data on session', () => {
  it('populates appointments and myAppointments for logged in user', async () => {
    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return makeFromChain({
          then: jest.fn((cb: (v: any) => any) =>
            Promise.resolve(cb({ data: [mockAppt], error: null }))
          ),
        });
      }
      // cancellation_tokens
      return makeFromChain({
        then: jest.fn((cb: (v: any) => any) =>
          Promise.resolve(cb({ data: [mockToken], error: null }))
        ),
      });
    });

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useAppointments(baseProfile));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', { user: { id: 'user-1', email: 'max@example.com' } });
      await new Promise(r => setTimeout(r, 20));
    });

    expect(result.current.appointments).toHaveLength(1);
    expect(result.current.myAppointments).toHaveLength(1);
    expect(result.current.activeTokens).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it('filters myAppointments to only current user', async () => {
    const otherUserAppt = { ...mockAppt, id: 'appt-2', user_id: 'other-user' };
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return makeFromChain({
          then: jest.fn((cb: (v: any) => any) =>
            Promise.resolve(cb({ data: [mockAppt, otherUserAppt], error: null }))
          ),
        });
      }
      return makeFromChain({
        then: jest.fn((cb: (v: any) => any) =>
          Promise.resolve(cb({ data: [], error: null }))
        ),
      });
    });

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useAppointments(baseProfile));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', { user: { id: 'user-1', email: 'max@example.com' } });
      await new Promise(r => setTimeout(r, 20));
    });

    expect(result.current.appointments).toHaveLength(2);
    expect(result.current.myAppointments).toHaveLength(1);
    expect(result.current.myAppointments[0].id).toBe('appt-1');
  });
});

describe('useAppointments – addAppointment', () => {
  it('returns error when no active token for category', async () => {
    (supabase.from as jest.Mock).mockReturnValue(makeFromChain({
      then: jest.fn((cb: (v: any) => any) =>
        Promise.resolve(cb({ data: [], error: null }))
      ),
    }));

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useAppointments(baseProfile));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', { user: { id: 'user-1', email: 'max@example.com' } });
      await new Promise(r => setTimeout(r, 20));
    });

    let addResult: any;
    await act(async () => {
      addResult = await result.current.addAppointment('2024-07-01', '10:00', 'individual');
    });

    expect(addResult.error?.message).toContain('Stornierungstoken');
  });

  it('returns error when no user session', async () => {
    (supabase.auth as any).getSession = jest.fn().mockResolvedValue({
      data: { session: null },
    });

    const { result } = renderHook(() => useAppointments(null));

    let addResult: any;
    await act(async () => {
      addResult = await result.current.addAppointment('2024-07-01', '10:00', 'individual');
    });

    expect(addResult.error?.message).toContain('eingeloggt');
  });
});

describe('useAppointments – cancelAppointment', () => {
  it('calls updateStatus with cancelled', async () => {
    const apptList = [mockAppt];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return makeFromChain({
          then: jest.fn((cb: (v: any) => any) =>
            Promise.resolve(cb({ data: apptList, error: null }))
          ),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        });
      }
      // tokens and profiles
      return makeFromChain({
        then: jest.fn((cb: (v: any) => any) =>
          Promise.resolve(cb({ data: [], error: null }))
        ),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
    });

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useAppointments(baseProfile));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', { user: { id: 'user-1', email: 'max@example.com' } });
      await new Promise(r => setTimeout(r, 20));
    });

    await act(async () => {
      await result.current.cancelAppointment('appt-1', true);
    });

    expect(supabase.from).toHaveBeenCalledWith('appointments');
  });
});

describe('useAppointments – cleanup', () => {
  it('unsubscribes and removes channel on unmount', async () => {
    const triggerAuth = captureAuthCallback();
    const { unmount } = renderHook(() => useAppointments(null));

    await act(async () => {
      triggerAuth('INITIAL_SESSION', null);
      await Promise.resolve();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});
