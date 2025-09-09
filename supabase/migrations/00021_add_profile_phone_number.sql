-- Add phone_number to profiles to support phone-based membership lookup
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Optional: normalize format decision is app-level; here we just add an index
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

