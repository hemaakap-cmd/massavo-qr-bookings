-- Security remediation (item 3): DB-level guarantee that a booking has at most
-- ONE pending reschedule request. Combined with the conditional
-- (status = 'pending') UPDATE in the respond-to-reschedule edge function this
-- removes the check-then-update race entirely: the losing transaction either
-- updates zero rows or is rejected by this index.
CREATE UNIQUE INDEX IF NOT EXISTS booking_reschedules_one_pending_per_booking
  ON public.booking_reschedules (booking_id)
  WHERE status = 'pending';

-- Tokens are the sole authorization factor for the customer-facing reschedule
-- and cancellation flows, so they must be unique and fast to look up.
CREATE UNIQUE INDEX IF NOT EXISTS booking_reschedules_token_unique
  ON public.booking_reschedules (reschedule_token);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_cancellation_token_unique
  ON public.bookings (cancellation_token)
  WHERE cancellation_token IS NOT NULL;