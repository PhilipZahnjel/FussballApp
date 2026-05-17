import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

const mockUnsubscribe = jest.fn();
const mockChannelObj = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis(), unsubscribe: jest.fn() };

function makeChain(resolvedValue: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
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
});

describe('useProfile – initial state', () => {
  it('starts with loading true and no profile', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();
  });
});

describe('useProfile – auth callback: no session', () => {
  it('sets loading false and profile null when session is null', async () => {
    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useProfile());

    await act(async () => {
      triggerAuth('INITIAL_SESSION', null);
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();
  });
});

describe('useProfile – auth callback: valid session', () => {
  it('loads profile data from ProfileService.fetchById', async () => {
    const mockProfileData = {
      id: 'user-1',
      full_name: 'Max Mustermann',
      phone: '0170111222',
      customer_number: 101,
      is_active: true,
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

    (supabase.from as jest.Mock).mockReturnValue(makeChain({ data: mockProfileData, error: null }));

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useProfile());

    await act(async () => {
      triggerAuth('INITIAL_SESSION', {
        user: { id: 'user-1', email: 'max@example.com' },
      });
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.profile?.full_name).toBe('Max Mustermann');
    expect(result.current.profile?.email).toBe('max@example.com');
    expect(result.current.loading).toBe(false);
  });

  it('merges email from session over DB value', async () => {
    const mockProfileData = { id: 'u2', full_name: 'Test', email: 'old@db.com', role: 'customer', customer_number: 102, is_active: true };
    (supabase.from as jest.Mock).mockReturnValue(makeChain({ data: mockProfileData, error: null }));

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useProfile());

    await act(async () => {
      triggerAuth('INITIAL_SESSION', {
        user: { id: 'u2', email: 'session@email.com' },
      });
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.profile?.email).toBe('session@email.com');
  });
});

describe('useProfile – cleanup', () => {
  it('unsubscribes from auth and removes channel on unmount', async () => {
    const triggerAuth = captureAuthCallback();
    const { unmount } = renderHook(() => useProfile());

    await act(async () => {
      triggerAuth('INITIAL_SESSION', null);
      await Promise.resolve();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('useProfile – DB error', () => {
  it('sets profile to null when fetchById returns error', async () => {
    (supabase.from as jest.Mock).mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));

    const triggerAuth = captureAuthCallback();
    const { result } = renderHook(() => useProfile());

    await act(async () => {
      triggerAuth('INITIAL_SESSION', { user: { id: 'bad-id', email: 'x@x.com' } });
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
