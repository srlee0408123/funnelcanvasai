-- Payments backfill and defaults
--
-- Purpose:
-- 1) Ensure cancel_at_period_end has a sane default (false)
-- 2) Backfill period fields for MEMBERSHIP_PAYMENT rows
--    - SUCCESS: activated_at/current_period_start/end/next_renewal_at, status ACTIVE
--    - CANCEL: canceled_at, period fields, 3-day refund rule (immediate vs scheduled)
-- 3) Set scheduled_downgrade_at for scheduled cancellations

-- 1) Default adjustments (safe)
ALTER TABLE public.payments
ALTER COLUMN cancel_at_period_end SET DEFAULT false;

-- 2) Backfill for SUCCESS rows
UPDATE public.payments p
SET
  activated_at = COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at),
  current_period_start = COALESCE(p.current_period_start, p.date, p.created_at),
  current_period_end = COALESCE(
    p.current_period_end,
    COALESCE(p.current_period_start, p.date, p.created_at) + INTERVAL '1 month'
  ),
  next_renewal_at = COALESCE(
    p.next_renewal_at,
    COALESCE(p.current_period_start, p.date, p.created_at) + INTERVAL '1 month'
  ),
  subscription_status = COALESCE(p.subscription_status, 'ACTIVE'),
  cancel_at_period_end = COALESCE(p.cancel_at_period_end, false),
  canceled_at = NULL,
  scheduled_downgrade_at = NULL,
  scheduled_downgrade_processed = COALESCE(p.scheduled_downgrade_processed, false),
  updated_at = TIMEZONE('utc', NOW())
WHERE p.type = 'MEMBERSHIP_PAYMENT'
  AND p.status = 'SUCCESS'
  AND (
    p.activated_at IS NULL OR
    p.current_period_start IS NULL OR
    p.current_period_end IS NULL OR
    p.next_renewal_at IS NULL OR
    p.subscription_status IS NULL OR
    p.cancel_at_period_end IS NULL
  );

-- 3) Backfill for CANCEL rows
-- 3-1) Ensure canceled_at set
UPDATE public.payments p
SET
  canceled_at = COALESCE(p.canceled_at, p.date, p.created_at),
  updated_at = TIMEZONE('utc', NOW())
WHERE p.type = 'MEMBERSHIP_PAYMENT'
  AND p.status = 'CANCEL'
  AND p.canceled_at IS NULL;

-- 3-2) Compute period fields and 3-day refund rule
-- Rule:
-- - If canceled_at <= activated_at + 3 days -> immediate refund (cancel_at_period_end=false, no schedule)
-- - Else -> scheduled cancel at period end (cancel_at_period_end=true, schedule at current_period_end)
UPDATE public.payments p
SET
  current_period_start = COALESCE(p.current_period_start, p.activated_at, p.date, p.created_at),
  current_period_end = COALESCE(
    p.current_period_end,
    COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '1 month'
  ),
  next_renewal_at = COALESCE(
    p.next_renewal_at,
    COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '1 month'
  ),
  subscription_status = COALESCE(p.subscription_status, 'CANCELED'),
  cancel_at_period_end = CASE
    WHEN p.cancel_at_period_end IS NOT NULL THEN p.cancel_at_period_end
    WHEN COALESCE(p.canceled_at, p.date, p.created_at) <= COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '3 days' THEN false
    ELSE true
  END,
  scheduled_downgrade_at = CASE
    WHEN (
      CASE
        WHEN p.cancel_at_period_end IS NOT NULL THEN p.cancel_at_period_end
        WHEN COALESCE(p.canceled_at, p.date, p.created_at) <= COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '3 days' THEN false
        ELSE true
      END
    ) = true
    THEN COALESCE(p.current_period_end, COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '1 month')
    ELSE NULL
  END,
  scheduled_downgrade_processed = CASE
    WHEN (
      CASE
        WHEN p.cancel_at_period_end IS NOT NULL THEN p.cancel_at_period_end
        WHEN COALESCE(p.canceled_at, p.date, p.created_at) <= COALESCE(p.activated_at, p.current_period_start, p.date, p.created_at) + INTERVAL '3 days' THEN false
        ELSE true
      END
    ) = false
    THEN true
    ELSE COALESCE(p.scheduled_downgrade_processed, false)
  END,
  updated_at = TIMEZONE('utc', NOW())
WHERE p.type = 'MEMBERSHIP_PAYMENT'
  AND p.status = 'CANCEL';

-- 3-3) Ensure indexes for scheduling queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_payments_next_renewal ON public.payments(next_renewal_at);
CREATE INDEX IF NOT EXISTS idx_payments_scheduled_dg ON public.payments(scheduled_downgrade_at) WHERE scheduled_downgrade_processed = false;


