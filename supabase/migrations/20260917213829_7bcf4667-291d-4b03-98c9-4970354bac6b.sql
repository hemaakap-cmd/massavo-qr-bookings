-- N-2: PUBLIC still held EXECUTE on these venue-data functions, which let the
-- anon role bypass the QR gate. Revoke from PUBLIC and anon; authenticated
-- (staff/admin) and service_role (venue-access edge function) keep access.
REVOKE EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_hotel_booked_slots(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_gym_available_dates(uuid, date, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_hotel_available_dates(uuid, date, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_service_price(text, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hotel_booked_slots(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gym_available_dates(uuid, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hotel_available_dates(uuid, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_service_price(text, uuid, uuid) TO authenticated, service_role;