import { supabase } from '../../lib/supabase';
import { PlayerType, TrainerSpecialty } from '../../types';

export type CreateCustomerParams = {
  email: string;
  full_name: string;
  phone: string;
  birth_date: string;
  address: string;
  parent_name: string;
  player_type: PlayerType | null;
  location: string;
  role?: 'customer' | 'trainer';
  trainer_specialty?: TrainerSpecialty;
};

export const CustomerService = {
  create: (params: CreateCustomerParams) =>
    supabase.functions.invoke('create-customer', { body: params }),

  delete: (customerId: string) =>
    supabase.functions.invoke('delete-customer', { body: { customerId } }),
};
