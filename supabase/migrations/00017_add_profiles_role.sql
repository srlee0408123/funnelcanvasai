-- Add role column to profiles and basic constraints
-- Roles: 'user' (default), 'admin'

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Optional: index for role-based queries (e.g., lists of admins)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


