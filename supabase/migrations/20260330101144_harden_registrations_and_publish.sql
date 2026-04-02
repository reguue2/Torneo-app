alter type public.registration_status add value if not exists 'pending_verification';
alter type public.registration_status add value if not exists 'pending_cash_validation';
alter type public.registration_status add value if not exists 'pending_online_payment';
alter type public.registration_status add value if not exists 'confirmed';
alter type public.registration_status add value if not exists 'expired';

