import { ProfileService } from '../services/profileService';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return {
    supabase: {
      from: jest.fn(() => chain),
      _chain: chain,
    },
  };
});

const mockChain = (supabase as any)._chain;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockChain).forEach(key => {
    if (key !== 'single') {
      (mockChain[key] as jest.Mock).mockReturnValue(mockChain);
    }
  });
  (mockChain.single as jest.Mock).mockResolvedValue({ data: null, error: null });
});

describe('ProfileService.fetchById', () => {
  it('queries profiles with user id and returns single', () => {
    ProfileService.fetchById('user-1');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(mockChain.single).toHaveBeenCalled();
  });
});

describe('ProfileService.fetchAllCustomers', () => {
  it('filters by role customer and orders by full_name', () => {
    ProfileService.fetchAllCustomers();
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(mockChain.eq).toHaveBeenCalledWith('role', 'customer');
    expect(mockChain.order).toHaveBeenCalledWith('full_name');
  });
});

describe('ProfileService.fetchTrainers', () => {
  it('filters by role trainer and selects specific fields', () => {
    ProfileService.fetchTrainers();
    expect(mockChain.select).toHaveBeenCalledWith('id, full_name, trainer_specialty');
    expect(mockChain.eq).toHaveBeenCalledWith('role', 'trainer');
    expect(mockChain.order).toHaveBeenCalledWith('full_name');
  });
});

describe('ProfileService.update', () => {
  it('updates fields for given user id', () => {
    ProfileService.update('user-1', { phone: '0170123456' });
    expect(mockChain.update).toHaveBeenCalledWith({ phone: '0170123456' });
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('can update multiple fields at once', () => {
    const fields = { level: 'profi', is_active: true };
    ProfileService.update('user-2', fields);
    expect(mockChain.update).toHaveBeenCalledWith(fields);
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-2');
  });
});
