begin;

alter table public.registration_requests
  add column if not exists resend_count integer not null default 0,
  add column if not exists last_email_sent_at timestamp with time zone not null default now();

create or replace function public.normalize_spanish_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(trim(coalesce(p_phone, '')), '\D', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  if v_digits like '0034%' then
    v_digits := substring(v_digits from 5);
  elsif length(v_digits) = 11 and v_digits like '34%' then
    v_digits := substring(v_digits from 3);
  end if;

  if v_digits ~ '^[6789][0-9]{8}$' then
    return v_digits;
  end if;

  return null;
end;
$$;

create or replace function public.create_public_registration_request(
  p_tournament_id uuid,
  p_display_name text,
  p_contact_phone text,
  p_category_id uuid default null,
  p_contact_email text default null,
  p_payment_method public.registration_payment_method default 'cash'::public.registration_payment_method
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_category public.categories%rowtype;
  v_display_name text;
  v_phone_raw text;
  v_phone_normalized text;
  v_email_raw text;
  v_email_normalized text;
  v_request_id uuid;
  v_amount numeric;
  v_participant_type public.participant_type;
  v_verification_code text;
  v_verification_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  v_display_name := trim(coalesce(p_display_name, ''));
  if v_display_name = '' then
    raise exception 'Display name is required';
  end if;

  v_phone_raw := trim(coalesce(p_contact_phone, ''));
  v_phone_normalized := public.normalize_spanish_phone(v_phone_raw);
  if v_phone_normalized is null then
    raise exception 'Contact phone is invalid';
  end if;

  v_email_raw := trim(coalesce(p_contact_email, ''));
  v_email_normalized := public.normalize_email(v_email_raw);
  if v_email_normalized is null then
    raise exception 'Contact email is required';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'published' then
    raise exception 'Tournament is not open for registration';
  end if;

  if v_tournament.registration_deadline is not null and now() > v_tournament.registration_deadline then
    raise exception 'Registration deadline passed';
  end if;

  if v_tournament.has_categories then
    if p_category_id is null then
      raise exception 'Category is required';
    end if;

    select *
    into v_category
    from public.categories
    where id = p_category_id
      and tournament_id = p_tournament_id;

    if not found then
      raise exception 'Category not linked to tournament';
    end if;

    if v_category.participant_type is null then
      raise exception 'Category participant type is not configured';
    end if;

    v_participant_type := v_category.participant_type;
    v_amount := coalesce(v_category.price, 0);
  else
    if p_category_id is not null then
      raise exception 'Category is not allowed for this tournament';
    end if;

    if v_tournament.participant_type is null then
      raise exception 'Tournament participant type is not configured';
    end if;

    v_participant_type := v_tournament.participant_type;
    v_amount := coalesce(v_tournament.entry_price, 0);
  end if;

  if v_tournament.payment_method = 'cash'::public.payment_method_enum
     and p_payment_method <> 'cash'::public.registration_payment_method then
    raise exception 'Only cash registrations are available right now';
  end if;

  if v_tournament.payment_method = 'online'::public.payment_method_enum
     and p_payment_method <> 'online'::public.registration_payment_method then
    raise exception 'Only online registrations are available right now';
  end if;

  if exists (
    select 1
    from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.category_id is not distinct from p_category_id
      and r.status not in ('cancelled', 'expired')
      and (
        r.contact_email_normalized = v_email_normalized
        or r.contact_phone_normalized = v_phone_normalized
      )
  ) then
    raise exception 'A registration already exists with this email or phone';
  end if;

  if exists (
    select 1
    from public.registration_requests rr
    where rr.tournament_id = p_tournament_id
      and rr.category_id is not distinct from p_category_id
      and rr.consumed_at is null
      and rr.expires_at > now()
      and (
        rr.contact_email_normalized = v_email_normalized
        or rr.contact_phone_normalized = v_phone_normalized
      )
  ) then
    raise exception 'A verification request is already pending for this email or phone';
  end if;

  v_verification_code := lpad(((random() * 999999)::int)::text, 6, '0');
  v_verification_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.registration_requests (
    tournament_id,
    category_id,
    participant_type,
    display_name,
    contact_phone,
    contact_phone_normalized,
    contact_email,
    contact_email_normalized,
    players,
    payment_method,
    verification_code_hash,
    verification_token_hash,
    expires_at,
    resend_count,
    last_email_sent_at
  )
  values (
    p_tournament_id,
    p_category_id,
    v_participant_type,
    v_display_name,
    v_phone_raw,
    v_phone_normalized,
    v_email_raw,
    v_email_normalized,
    null,
    p_payment_method,
    extensions.crypt(v_verification_code, extensions.gen_salt('bf')),
    public.sha256_hex(v_verification_token),
    v_expires_at,
    0,
    now()
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'verification_code', v_verification_code,
    'verification_token', v_verification_token,
    'expires_at', v_expires_at,
    'amount', coalesce(v_amount, 0),
    'payment_method', p_payment_method
  );
end;
$$;

create or replace function public.resend_public_registration_request(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.registration_requests%rowtype;
  v_tournament public.tournaments%rowtype;
  v_category public.categories%rowtype;
  v_amount numeric := 0;
  v_verification_code text;
  v_verification_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_new_request_id uuid;
  v_seconds_remaining integer;
begin
  select *
  into v_request
  from public.registration_requests
  where id = p_request_id;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if v_request.registration_id is not null or v_request.consumed_at is not null then
    raise exception 'Verification request already consumed';
  end if;

  v_seconds_remaining := greatest(0, 60 - floor(extract(epoch from (now() - v_request.last_email_sent_at)))::integer);

  if v_seconds_remaining > 0 then
    raise exception 'Resend cooldown active: % seconds remaining', v_seconds_remaining;
  end if;

  if v_request.resend_count >= 3 then
    raise exception 'Resend limit reached';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = v_request.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'published' then
    raise exception 'Tournament is not open for registration';
  end if;

  if v_tournament.registration_deadline is not null and now() > v_tournament.registration_deadline then
    raise exception 'Registration deadline passed';
  end if;

  if v_request.category_id is not null then
    select *
    into v_category
    from public.categories
    where id = v_request.category_id
      and tournament_id = v_request.tournament_id;

    if not found then
      raise exception 'Category not linked to tournament';
    end if;

    if v_category.participant_type is distinct from v_request.participant_type then
      raise exception 'Category participant type changed after request creation';
    end if;

    v_amount := coalesce(v_category.price, 0);
  else
    if v_tournament.participant_type is distinct from v_request.participant_type then
      raise exception 'Tournament participant type changed after request creation';
    end if;

    v_amount := coalesce(v_tournament.entry_price, 0);
  end if;

  if exists (
    select 1
    from public.registrations r
    where r.tournament_id = v_request.tournament_id
      and r.category_id is not distinct from v_request.category_id
      and r.status not in ('cancelled', 'expired')
      and (
        r.contact_email_normalized = v_request.contact_email_normalized
        or r.contact_phone_normalized = v_request.contact_phone_normalized
      )
  ) then
    raise exception 'A registration already exists with this email or phone';
  end if;

  update public.registration_requests
  set expires_at = now() - interval '1 second'
  where id = v_request.id;

  v_verification_code := lpad(((random() * 999999)::int)::text, 6, '0');
  v_verification_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.registration_requests (
    tournament_id,
    category_id,
    participant_type,
    display_name,
    contact_phone,
    contact_phone_normalized,
    contact_email,
    contact_email_normalized,
    players,
    payment_method,
    verification_code_hash,
    verification_token_hash,
    expires_at,
    resend_count,
    last_email_sent_at
  )
  values (
    v_request.tournament_id,
    v_request.category_id,
    v_request.participant_type,
    v_request.display_name,
    v_request.contact_phone,
    v_request.contact_phone_normalized,
    v_request.contact_email,
    v_request.contact_email_normalized,
    null,
    v_request.payment_method,
    extensions.crypt(v_verification_code, extensions.gen_salt('bf')),
    public.sha256_hex(v_verification_token),
    v_expires_at,
    v_request.resend_count + 1,
    now()
  )
  returning id into v_new_request_id;

  return jsonb_build_object(
    'request_id', v_new_request_id,
    'verification_code', v_verification_code,
    'verification_token', v_verification_token,
    'expires_at', v_expires_at,
    'amount', coalesce(v_amount, 0),
    'payment_method', v_request.payment_method,
    'contact_email', v_request.contact_email
  );
end;
$$;

grant execute on function public.normalize_spanish_phone(text) to anon, authenticated, service_role;
grant execute on function public.resend_public_registration_request(uuid) to anon, authenticated, service_role;

commit;
