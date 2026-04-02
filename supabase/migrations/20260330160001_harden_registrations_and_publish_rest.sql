create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '')
$$;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(trim(coalesce(p_phone, '')), '\D', '', 'g'), '')
$$;

create or replace function public.sha256_hex(p_value text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(coalesce(p_value, ''), 'sha256'), 'hex')
$$;

create table if not exists public.registration_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  participant_type public.participant_type not null,
  display_name text not null,
  contact_phone text not null,
  contact_phone_normalized text not null,
  contact_email text not null,
  contact_email_normalized text not null,
  players jsonb,
  payment_method public.registration_payment_method not null,
  verification_code_hash text not null,
  verification_token_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  registration_id uuid references public.registrations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint registration_requests_display_name_check check (trim(display_name) <> '')
);

create index if not exists registration_requests_lookup_idx
  on public.registration_requests (tournament_id, category_id, contact_email_normalized, contact_phone_normalized);

create index if not exists registration_requests_open_idx
  on public.registration_requests (expires_at)
  where consumed_at is null;

alter table public.registration_requests enable row level security;

revoke all on table public.registration_requests from anon;
revoke all on table public.registration_requests from authenticated;
grant all on table public.registration_requests to service_role;

update public.registrations r
set tournament_id = c.tournament_id
from public.categories c
where r.category_id = c.id
  and r.tournament_id is null;

alter table public.registrations
  add column if not exists public_reference text,
  add column if not exists contact_email_normalized text,
  add column if not exists contact_phone_normalized text,
  add column if not exists cancel_code_hash text,
  add column if not exists cancel_token_hash text,
  add column if not exists cancelled_at timestamptz;

update public.registrations r
set
  contact_email_normalized = public.normalize_email(p.contact_email),
  contact_phone_normalized = public.normalize_phone(p.contact_phone),
  public_reference = coalesce(
    r.public_reference,
    'REG-' || upper(substring(replace(r.id::text, '-', '') from 1 for 10))
  )
from public.participants p
where p.id = r.participant_id;

alter table public.registrations
  alter column tournament_id set not null;

alter table public.registrations
  drop constraint if exists registrations_tournament_or_category_check;

create unique index if not exists registrations_public_reference_key
  on public.registrations (public_reference)
  where public_reference is not null;

create unique index if not exists registrations_active_email_unique
  on public.registrations (
    tournament_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    contact_email_normalized
  )
  where contact_email_normalized is not null
    and status not in ('cancelled', 'expired');

create unique index if not exists registrations_active_phone_unique
  on public.registrations (
    tournament_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    contact_phone_normalized
  )
  where contact_phone_normalized is not null
    and status not in ('cancelled', 'expired');

drop policy if exists "Public can insert participants" on public.participants;
drop policy if exists "Allow public insert registrations if published" on public.registrations;

revoke insert on table public.participants from anon;
revoke insert on table public.registrations from anon;

revoke execute on function public.create_public_registration(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) from anon, authenticated;

create or replace function public.check_registration_rules()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
  max_allowed integer;
  deadline timestamp;
  tourn_status public.tournament_status;
  v_has_categories boolean;
  v_category_tournament_id uuid;
begin
  if new.tournament_id is null then
    raise exception 'Tournament is required';
  end if;

  select t.status, t.registration_deadline, t.has_categories
  into tourn_status, deadline, v_has_categories
  from public.tournaments t
  where t.id = new.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if new.category_id is not null then
    select c.tournament_id
    into v_category_tournament_id
    from public.categories c
    where c.id = new.category_id;

    if v_category_tournament_id is null then
      raise exception 'Category not linked to tournament';
    end if;

    if v_category_tournament_id <> new.tournament_id then
      raise exception 'Category not linked to tournament';
    end if;
  end if;

  if v_has_categories and new.category_id is null then
    raise exception 'Category is required';
  end if;

  if not v_has_categories and new.category_id is not null then
    raise exception 'Category is not allowed for this tournament';
  end if;

  if tourn_status <> 'published' then
    raise exception 'Tournament is not open for registration';
  end if;

  if deadline is not null and now() > deadline then
    raise exception 'Registration deadline passed';
  end if;

  if new.category_id is not null then
    select count(*) into current_count
    from public.registrations r
    where r.category_id = new.category_id
      and r.status not in ('cancelled', 'expired');

    select c.max_participants into max_allowed
    from public.categories c
    where c.id = new.category_id;

    if max_allowed is not null and current_count >= max_allowed then
      raise exception 'Category is full';
    end if;
  else
    select count(*) into current_count
    from public.registrations r
    where r.tournament_id = new.tournament_id
      and r.category_id is null
      and r.status not in ('cancelled', 'expired');

    select t.max_participants into max_allowed
    from public.tournaments t
    where t.id = new.tournament_id;

    if max_allowed is not null and current_count >= max_allowed then
      raise exception 'Tournament is full';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.generate_public_reference()
returns text
language plpgsql
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'REG-' || upper(substring(encode(extensions.gen_random_bytes(6), 'hex') from 1 for 10));

    exit when not exists (
      select 1
      from public.registrations r
      where r.public_reference = v_reference
    );
  end loop;

  return v_reference;
end;
$$;

create or replace function public.create_public_registration_request(
  p_tournament_id uuid,
  p_participant_type public.participant_type,
  p_display_name text,
  p_contact_phone text,
  p_category_id uuid default null,
  p_contact_email text default null,
  p_players jsonb default null,
  p_payment_method public.registration_payment_method default 'cash'
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
  v_phone_normalized text;
  v_email_normalized text;
  v_request_id uuid;
  v_amount numeric;
  v_verification_code text;
  v_verification_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  v_display_name := trim(coalesce(p_display_name, ''));
  if v_display_name = '' then
    raise exception 'Display name is required';
  end if;

  v_phone_normalized := public.normalize_phone(p_contact_phone);
  if v_phone_normalized is null then
    raise exception 'Contact phone is required';
  end if;

  v_email_normalized := public.normalize_email(p_contact_email);
  if v_email_normalized is null then
    raise exception 'Contact email is required';
  end if;

  if p_participant_type = 'team'::public.participant_type then
    if p_players is null or jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 2 then
      raise exception 'Team must have at least 2 players';
    end if;
  else
    p_players := null;
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

    v_amount := coalesce(v_category.price, 0);
  else
    if p_category_id is not null then
      raise exception 'Category is not allowed for this tournament';
    end if;

    v_amount := coalesce(v_tournament.entry_price, 0);
  end if;

  if v_tournament.payment_method = 'cash'::public.payment_method_enum and p_payment_method <> 'cash'::public.registration_payment_method then
    raise exception 'Only cash registrations are available right now';
  end if;

  if v_tournament.payment_method = 'online'::public.payment_method_enum and p_payment_method <> 'online'::public.registration_payment_method then
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
    expires_at
  )
  values (
    p_tournament_id,
    p_category_id,
    p_participant_type,
    v_display_name,
    trim(p_contact_phone),
    v_phone_normalized,
    v_email_normalized,
    v_email_normalized,
    p_players,
    p_payment_method,
    extensions.crypt(v_verification_code, extensions.gen_salt('bf')),
    public.sha256_hex(v_verification_token),
    v_expires_at
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

create or replace function public.verify_public_registration_request(
  p_request_id uuid,
  p_verification_code text default null,
  p_verification_token text default null
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
  v_participant_id uuid;
  v_registration_id uuid;
  v_public_reference text;
  v_amount numeric;
  v_registration_status public.registration_status;
  v_payment_status public.payment_status;
  v_cancel_code text;
  v_cancel_token text;
  v_existing_registration public.registrations%rowtype;
begin
  select *
  into v_request
  from public.registration_requests
  where id = p_request_id;

  if not found then
    raise exception 'Verification request not found';
  end if;

  if v_request.consumed_at is not null and v_request.registration_id is not null then
    select *
    into v_existing_registration
    from public.registrations
    where id = v_request.registration_id;

    return jsonb_build_object(
      'already_verified', true,
      'registration_id', v_existing_registration.id,
      'public_reference', v_existing_registration.public_reference,
      'registration_status', v_existing_registration.status,
      'payment_method', v_existing_registration.payment_method
    );
  end if;

  if v_request.expires_at <= now() then
    raise exception 'Verification request expired';
  end if;

  if coalesce(trim(p_verification_token), '') <> '' then
    if public.sha256_hex(trim(p_verification_token)) <> v_request.verification_token_hash then
      raise exception 'Invalid verification token';
    end if;
  elsif coalesce(trim(p_verification_code), '') <> '' then
    if extensions.crypt(trim(p_verification_code), v_request.verification_code_hash) <> v_request.verification_code_hash then
      raise exception 'Invalid verification code';
    end if;
  else
    raise exception 'Verification token or code is required';
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

    v_amount := coalesce(v_category.price, 0);
  else
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

  insert into public.participants (
    type,
    display_name,
    contact_phone,
    contact_email,
    players
  )
  values (
    v_request.participant_type,
    v_request.display_name,
    v_request.contact_phone,
    v_request.contact_email,
    v_request.players
  )
  returning id into v_participant_id;

  v_registration_status :=
    case
      when coalesce(v_amount, 0) <= 0 then 'confirmed'::public.registration_status
      when v_request.payment_method = 'cash'::public.registration_payment_method then 'pending_cash_validation'::public.registration_status
      else 'pending_online_payment'::public.registration_status
    end;

  v_payment_status :=
    case
      when coalesce(v_amount, 0) <= 0 then 'paid'::public.payment_status
      else 'pending'::public.payment_status
    end;

  v_public_reference := public.generate_public_reference();
  v_cancel_code := lpad(((random() * 999999)::int)::text, 6, '0');
  v_cancel_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.registrations (
    tournament_id,
    category_id,
    participant_id,
    status,
    payment_method,
    public_reference,
    contact_email_normalized,
    contact_phone_normalized,
    cancel_code_hash,
    cancel_token_hash,
    cancelled_at
  )
  values (
    v_request.tournament_id,
    v_request.category_id,
    v_participant_id,
    v_registration_status,
    v_request.payment_method,
    v_public_reference,
    v_request.contact_email_normalized,
    v_request.contact_phone_normalized,
    extensions.crypt(v_cancel_code, extensions.gen_salt('bf')),
    public.sha256_hex(v_cancel_token),
    null
  )
  returning id into v_registration_id;

  update public.participants
  set source_registration_id = v_registration_id
  where id = v_participant_id;

  insert into public.payments (
    registration_id,
    amount,
    payment_method,
    status,
    paid_at
  )
  values (
    v_registration_id,
    coalesce(v_amount, 0),
    v_request.payment_method,
    v_payment_status,
    case
      when v_payment_status = 'paid'::public.payment_status then now()
      else null
    end
  );

  update public.registration_requests
  set
    verified_at = now(),
    consumed_at = now(),
    registration_id = v_registration_id
  where id = v_request.id;

  return jsonb_build_object(
    'already_verified', false,
    'registration_id', v_registration_id,
    'public_reference', v_public_reference,
    'registration_status', v_registration_status,
    'payment_method', v_request.payment_method,
    'amount', coalesce(v_amount, 0),
    'cancel_code', v_cancel_code,
    'cancel_token', v_cancel_token
  );
end;
$$;

create or replace function public.cancel_public_registration(
  p_public_reference text,
  p_cancel_code text default null,
  p_cancel_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_payment public.payments%rowtype;
begin
  select *
  into v_registration
  from public.registrations
  where public_reference = trim(coalesce(p_public_reference, ''));

  if not found then
    raise exception 'Registration not found';
  end if;

  if v_registration.status = 'cancelled'::public.registration_status then
    return jsonb_build_object(
      'already_cancelled', true,
      'public_reference', v_registration.public_reference,
      'status', v_registration.status
    );
  end if;

  if coalesce(trim(p_cancel_token), '') <> '' then
    if public.sha256_hex(trim(p_cancel_token)) <> v_registration.cancel_token_hash then
      raise exception 'Invalid cancel token';
    end if;
  elsif coalesce(trim(p_cancel_code), '') <> '' then
    if extensions.crypt(trim(p_cancel_code), v_registration.cancel_code_hash) <> v_registration.cancel_code_hash then
      raise exception 'Invalid cancel code';
    end if;
  else
    raise exception 'Cancel token or code is required';
  end if;

  update public.registrations
  set
    status = 'cancelled'::public.registration_status,
    cancelled_at = now()
  where id = v_registration.id;

  select *
  into v_payment
  from public.payments
  where registration_id = v_registration.id
  order by created_at asc nulls last
  limit 1;

  if found and v_payment.amount > 0 and v_payment.status = 'paid'::public.payment_status then
    update public.payments
    set status = 'refunded'::public.payment_status
    where id = v_payment.id;
  end if;

  return jsonb_build_object(
    'already_cancelled', false,
    'public_reference', v_registration.public_reference,
    'status', 'cancelled'
  );
end;
$$;

create or replace function public.publish_tournament(
  p_tournament_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_categories_count integer;
  v_invalid_categories integer;
  v_invalid_prizes integer;
begin
  select *
  into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if auth.uid() is null or auth.uid() <> v_tournament.organizer_id then
    raise exception 'You cannot publish this tournament';
  end if;

  if v_tournament.status <> 'draft'::public.tournament_status then
    raise exception 'Only draft tournaments can be published';
  end if;

  if v_tournament.payment_method is null then
    raise exception 'Payment method is required';
  end if;

  if v_tournament.date is null then
    raise exception 'Tournament date is required';
  end if;

  if v_tournament.registration_deadline is null then
    raise exception 'Registration deadline is required';
  end if;

  if v_tournament.registration_deadline > v_tournament.date then
    raise exception 'Registration deadline cannot be after tournament date';
  end if;

  if trim(coalesce(v_tournament.province, '')) = '' then
    raise exception 'Province is required';
  end if;

  if trim(coalesce(v_tournament.address, '')) = '' then
    raise exception 'Address is required';
  end if;

  if v_tournament.min_participants <= 0 then
    raise exception 'Tournament min participants are invalid';
  end if;

  if v_tournament.max_participants is not null and v_tournament.max_participants < v_tournament.min_participants then
    raise exception 'Tournament max participants are invalid';
  end if;

  if not v_tournament.has_categories and coalesce(v_tournament.entry_price, 0) < 0 then
    raise exception 'Tournament entry price is invalid';
  end if;

  if v_tournament.has_categories then
    select count(*) into v_categories_count
    from public.categories c
    where c.tournament_id = v_tournament.id;

    if v_categories_count = 0 then
      raise exception 'At least one category is required';
    end if;

    select count(*) into v_invalid_categories
    from public.categories c
    where c.tournament_id = v_tournament.id
      and (
        trim(coalesce(c.name, '')) = ''
        or c.price < 0
        or c.min_participants <= 0
        or (c.max_participants is not null and c.max_participants < c.min_participants)
      );

    if v_invalid_categories > 0 then
      raise exception 'Categories contain invalid data';
    end if;
  end if;

  if v_tournament.prize_mode = 'global'::public.prize_mode and trim(coalesce(v_tournament.prizes, '')) = '' then
    raise exception 'Global prizes are required';
  end if;

  if v_tournament.prize_mode = 'per_category'::public.prize_mode then
    select count(*) into v_invalid_prizes
    from public.categories c
    where c.tournament_id = v_tournament.id
      and trim(coalesce(c.prizes, '')) = '';

    if v_invalid_prizes > 0 then
      raise exception 'Category prizes are required';
    end if;
  end if;

  update public.tournaments
  set status = 'published'::public.tournament_status
  where id = v_tournament.id;

  return v_tournament.id;
end;
$$;

grant execute on function public.create_public_registration_request(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) to anon, authenticated, service_role;

grant execute on function public.verify_public_registration_request(
  uuid,
  text,
  text
) to anon, authenticated, service_role;

grant execute on function public.cancel_public_registration(
  text,
  text,
  text
) to anon, authenticated, service_role;

grant execute on function public.publish_tournament(uuid) to authenticated, service_role;