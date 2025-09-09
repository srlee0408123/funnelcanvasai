-- Add simple plan to profiles with default 'free'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro'));

CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

