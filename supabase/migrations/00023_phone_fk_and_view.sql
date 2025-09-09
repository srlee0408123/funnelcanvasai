-- Ensure profiles.phone_number is unique and non-null for FK usage
ALTER TABLE public.profiles
ALTER COLUMN phone_number TYPE TEXT;

-- Enforce uniqueness for phone_number (allows NULL values)
-- This ensures each phone number can only be associated with one profile
ALTER TABLE public.profiles
ADD CONSTRAINT uq_profiles_phone_number UNIQUE (phone_number);

-- If you require strict non-null, uncomment the NOT NULL constraint line below
-- ALTER TABLE public.profiles ALTER COLUMN phone_number SET NOT NULL;

-- Add FK from payments.phone_number to profiles.phone_number (nullable FK)
ALTER TABLE public.payments
ADD CONSTRAINT fk_payments_phone_profiles
FOREIGN KEY (phone_number)
REFERENCES public.profiles(phone_number)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Helper view to quickly see payment with resolved profile plan by phone/email
CREATE OR REPLACE VIEW public.v_payments_with_profile AS
SELECT
  p.*,
  pr.id AS profile_id,
  pr.plan AS profile_plan
FROM public.payments p
LEFT JOIN public.profiles pr
  ON (p.phone_number IS NOT NULL AND pr.phone_number = p.phone_number)
  OR (p.phone_number IS NULL AND pr.email = p.email);


