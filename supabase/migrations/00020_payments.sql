-- Payments and billing basics
--
-- 1) payments: stores raw webhook payloads and normalized fields
-- 2) workspaces.plan: adds simple plan control (free | pro)

-- Subscription fields added:
-- - subscription_id: provider subscription identifier (optional)
-- - subscription_status: lifecycle state (ACTIVE/CANCELED/PAST_DUE/TRIALING/UNPAID)
-- - activated_at: when membership became active
-- - current_period_start/current_period_end: billing window
-- - next_renewal_at: next charge date (alias of period end depending on provider)
-- - cancel_at_period_end: if true, cancel scheduled at period end
-- - canceled_at: when membership was canceled

-- Add plan column to workspaces (default: free)
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro'));

-- Optional: quick lookup by plan
CREATE INDEX IF NOT EXISTS idx_workspaces_plan ON public.workspaces(plan);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('NORMAL_PAYMENT', 'MEMBERSHIP_PAYMENT')),
  name TEXT,
  email TEXT NOT NULL,
  phone_number TEXT,
  amount INTEGER,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'CANCEL')),
  -- Subscription-related (nullable for one-off payments)
  subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'UNPAID')),
  activated_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_renewal_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  canceled_at TIMESTAMPTZ,
  -- Scheduled downgrade (when cancel_at_period_end = true)
  scheduled_downgrade_at TIMESTAMPTZ,
  scheduled_downgrade_processed BOOLEAN NOT NULL DEFAULT false,
  date TIMESTAMPTZ,
  method TEXT,
  canceled_reason TEXT,
  option TEXT,
  forms JSONB,
  agreements JSONB,
  user_agent TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payments_email ON public.payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON public.payments(phone_number);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_status ON public.payments(subscription_status);
CREATE INDEX IF NOT EXISTS idx_payments_next_renewal ON public.payments(next_renewal_at);
CREATE INDEX IF NOT EXISTS idx_payments_scheduled_dg ON public.payments(scheduled_downgrade_at) WHERE scheduled_downgrade_processed = false;

-- RLS is handled via API routes using service role
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Keep updated_at fresh
CREATE TRIGGER set_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
