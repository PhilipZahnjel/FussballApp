export type AppointmentStatus = 'confirmed' | 'cancelled';

export type Appointment = {
  id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  program: string;
  user_id?: string;
};

export type Tab = 'home' | 'termine' | 'buchen' | 'messungen' | 'profil';
export type AdminTab = 'dashboard' | 'kunden' | 'kalender' | 'finanzen';

export type SubscriptionPlan = {
  id: string;
  name: string;
  ems_credits_per_month: number;
  lymph_credits_per_month: number;
  monthly_price: number;
  extra_ems_price: number;
  extra_lymph_price: number;
  discounted_lymph_price: number;
  is_active: boolean;
};

export type CustomerSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  plan?: SubscriptionPlan;
};

export type CreditBalance = {
  ems_balance: number;
  lymph_balance: number;
};

export type Measurement = {
  id: string;
  measured_at: string;
  weight: number | null;
  height: number | null;
  resting_pulse: number | null;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  body_fat: number | null;
  body_water: number | null;
  fat_free_mass: number | null;
  visceral_fat: number | null;
  muscle_mass: number | null;
  bone_mass: number | null;
  circumference_chest: number | null;
  circumference_hip: number | null;
  circumference_waist: number | null;
  circumference_arm_left: number | null;
  circumference_arm_right: number | null;
  circumference_leg_left: number | null;
  circumference_leg_right: number | null;
  bmr: number | null;
  rmr: number | null;
  active_metabolic_rate: number | null;
  total_metabolic_rate: number | null;
};
