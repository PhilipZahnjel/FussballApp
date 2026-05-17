-- Remove monthly quota system — app uses only cancellation tokens for extra bookings
ALTER TABLE profiles DROP COLUMN IF EXISTS quota_individual;
ALTER TABLE profiles DROP COLUMN IF EXISTS quota_gruppe;
