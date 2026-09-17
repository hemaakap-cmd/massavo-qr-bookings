-- N-1: venue service catalogue is authoritative.
CREATE OR REPLACE FUNCTION public.get_effective_service_price(_venue_type text, _venue_id uuid, _service_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base numeric;
  v_custom numeric;
  v_promo numeric;
  v_promo_start timestamptz;
  v_promo_end timestamptz;
  v_active boolean;
  v_found boolean := false;
BEGIN
  SELECT price INTO v_base FROM public.services WHERE id = _service_id AND is_active = true;
  IF v_base IS NULL THEN RETURN NULL; END IF;

  IF _venue_type = 'gym' THEN
    SELECT custom_price, promo_price, promo_starts_at, promo_ends_at, is_active, true
      INTO v_custom, v_promo, v_promo_start, v_promo_end, v_active, v_found
    FROM public.gym_services
    WHERE gym_id = _venue_id AND service_id = _service_id;
  ELSIF _venue_type = 'hotel' THEN
    SELECT custom_price, promo_price, promo_starts_at, promo_ends_at, is_active, true
      INTO v_custom, v_promo, v_promo_start, v_promo_end, v_active, v_found
    FROM public.hotel_services
    WHERE hotel_id = _venue_id AND service_id = _service_id;
  ELSE
    -- Non-venue channels (e.g. home visit) keep the base service price.
    RETURN v_base;
  END IF;

  -- No mapping => the service is NOT offered at this venue. Never fall back
  -- to the base price: the venue catalogue is authoritative.
  IF NOT v_found THEN RETURN NULL; END IF;
  IF v_active IS DISTINCT FROM true THEN RETURN NULL; END IF;

  IF v_promo IS NOT NULL
     AND (v_promo_start IS NULL OR v_promo_start <= now())
     AND (v_promo_end IS NULL OR v_promo_end >= now()) THEN
    RETURN v_promo;
  END IF;

  RETURN COALESCE(v_custom, v_base);
END;
$function$;

-- N-2: remove anonymous (non-QR) read access to venue-specific booking data.
REVOKE SELECT ON public.gym_services FROM anon;
REVOKE SELECT ON public.hotel_services FROM anon;
REVOKE SELECT ON public.gym_schedules FROM anon;
REVOKE SELECT ON public.hotel_schedules FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_gym_available_dates(uuid, date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_hotel_available_dates(uuid, date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_hotel_booked_slots(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_service_price(text, uuid, uuid) FROM anon;

-- Service role (edge functions) must keep full access to the QR-authorised path.
GRANT SELECT ON public.gym_services TO service_role;
GRANT SELECT ON public.hotel_services TO service_role;
GRANT SELECT ON public.gym_schedules TO service_role;
GRANT SELECT ON public.hotel_schedules TO service_role;