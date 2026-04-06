begin;

alter table public.tournaments
  add column if not exists participant_type public.participant_type;

alter table public.categories
  add column if not exists participant_type public.participant_type;

update public.tournaments
set participant_type = 'team'::public.participant_type
where has_categories = false
  and participant_type is null;

update public.categories
set participant_type = 'team'::public.participant_type
where participant_type is null;

update public.tournaments
set participant_type = null
where has_categories = true;

alter table public.categories
  alter column participant_type set not null;

alter table public.tournaments
  drop constraint if exists tournaments_participant_type_consistency_check;

alter table public.tournaments
  add constraint tournaments_participant_type_consistency_check
  check (
    (has_categories = true and participant_type is null)
    or (has_categories = false and participant_type is not null)
  );

create or replace function public.prevent_tournament_registration_config_change()
returns trigger
language plpgsql
as $$
declare
  v_has_active_registrations boolean := false;
  v_has_pending_requests boolean := false;
begin
  if old.has_categories is not distinct from new.has_categories
     and old.participant_type is not distinct from new.participant_type
     and old.payment_method is not distinct from new.payment_method then
    return new;
  end if;

  select exists (
    select 1
    from public.registrations r
    where r.tournament_id = old.id
      and r.status not in (
        'cancelled'::public.registration_status,
        'expired'::public.registration_status
      )
  ) into v_has_active_registrations;

  select exists (
    select 1
    from public.registration_requests rr
    where rr.tournament_id = old.id
      and rr.consumed_at is null
      and rr.expires_at > now()
  ) into v_has_pending_requests;

  if v_has_active_registrations or v_has_pending_requests then
    raise exception 'Tournament registration config cannot change after requests or registrations exist';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_category_registration_config_change()
returns trigger
language plpgsql
as $$
declare
  v_has_active_registrations boolean := false;
  v_has_pending_requests boolean := false;
begin
  if old.participant_type is not distinct from new.participant_type then
    return new;
  end if;

  select exists (
    select 1
    from public.registrations r
    where r.category_id = old.id
      and r.status not in (
        'cancelled'::public.registration_status,
        'expired'::public.registration_status
      )
  ) into v_has_active_registrations;

  select exists (
    select 1
    from public.registration_requests rr
    where rr.category_id = old.id
      and rr.consumed_at is null
      and rr.expires_at > now()
  ) into v_has_pending_requests;

  if v_has_active_registrations or v_has_pending_requests then
    raise exception 'Category registration config cannot change after requests or registrations exist';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_registration_config_change_on_tournaments on public.tournaments;
create trigger prevent_registration_config_change_on_tournaments
before update of has_categories, participant_type, payment_method
on public.tournaments
for each row
execute function public.prevent_tournament_registration_config_change();

drop trigger if exists prevent_registration_config_change_on_categories on public.categories;
create trigger prevent_registration_config_change_on_categories
before update of participant_type
on public.categories
for each row
execute function public.prevent_category_registration_config_change();

drop function if exists public.create_and_publish_tournament(
  text,
  text,
  text,
  text,
  text,
  timestamp without time zone,
  timestamp without time zone,
  boolean,
  boolean,
  integer,
  integer,
  public.payment_method_enum,
  public.prize_mode,
  text,
  text,
  numeric,
  jsonb
);

create function public.create_and_publish_tournament(
  p_title text,
  p_description text,
  p_poster_url text,
  p_province text,
  p_address text,
  p_date timestamp without time zone,
  p_registration_deadline timestamp without time zone,
  p_is_public boolean,
  p_has_categories boolean,
  p_participant_type public.participant_type default null,
  p_min_participants integer default 1,
  p_max_participants integer default null,
  p_payment_method public.payment_method_enum default null,
  p_prize_mode public.prize_mode default 'none'::public.prize_mode,
  p_prizes text default null,
  p_rules text default null,
  p_entry_price numeric default 0,
  p_categories jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_category jsonb;
  v_category_name text;
  v_category_participant_type_text text;
  v_category_participant_type public.participant_type;
  v_category_price numeric;
  v_category_min integer;
  v_category_max integer;
  v_category_start_at timestamp without time zone;
  v_category_address text;
  v_category_prizes text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required';
  end if;

  if trim(coalesce(p_poster_url, '')) = '' then
    raise exception 'Poster URL is required';
  end if;

  if trim(coalesce(p_province, '')) = '' then
    raise exception 'Province is required';
  end if;

  if trim(coalesce(p_address, '')) = '' then
    raise exception 'Address is required';
  end if;

  if p_date is null then
    raise exception 'Tournament date is required';
  end if;

  if p_registration_deadline is null then
    raise exception 'Registration deadline is required';
  end if;

  if p_registration_deadline > p_date then
    raise exception 'Registration deadline cannot be after tournament date';
  end if;

  if p_payment_method is null then
    raise exception 'Payment method is required';
  end if;

  if p_min_participants is null or p_min_participants <= 0 then
    raise exception 'Tournament min participants are invalid';
  end if;

  if p_max_participants is not null and p_max_participants < p_min_participants then
    raise exception 'Tournament max participants are invalid';
  end if;

  if p_has_categories then
    if p_participant_type is not null then
      raise exception 'Tournament participant type is not allowed when categories exist';
    end if;
  else
    if p_participant_type is null then
      raise exception 'Tournament participant type is required';
    end if;

    if coalesce(p_entry_price, 0) < 0 then
      raise exception 'Tournament entry price is invalid';
    end if;
  end if;

  if p_prize_mode = 'global'::public.prize_mode and trim(coalesce(p_prizes, '')) = '' then
    raise exception 'Global prizes are required';
  end if;

  if p_prize_mode = 'per_category'::public.prize_mode and not p_has_categories then
    raise exception 'Category prizes require categories';
  end if;

  insert into public.tournaments (
    organizer_id,
    title,
    description,
    poster_url,
    prizes,
    rules,
    province,
    address,
    date,
    max_participants,
    registration_deadline,
    payment_method,
    is_public,
    status,
    has_categories,
    participant_type,
    min_participants,
    prize_mode,
    entry_price
  )
  values (
    auth.uid(),
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    trim(p_poster_url),
    case
      when p_prize_mode = 'global'::public.prize_mode then nullif(trim(coalesce(p_prizes, '')), '')
      else null
    end,
    nullif(trim(coalesce(p_rules, '')), ''),
    trim(p_province),
    trim(p_address),
    p_date,
    p_max_participants,
    p_registration_deadline,
    p_payment_method,
    coalesce(p_is_public, true),
    'draft'::public.tournament_status,
    p_has_categories,
    case when p_has_categories then null else p_participant_type end,
    p_min_participants,
    coalesce(p_prize_mode, 'none'::public.prize_mode),
    coalesce(p_entry_price, 0)
  )
  returning id into v_tournament_id;

  if p_has_categories then
    for v_category in
      select value
      from jsonb_array_elements(p_categories)
    loop
      v_category_name := trim(coalesce(v_category->>'name', ''));
      v_category_participant_type_text := trim(coalesce(v_category->>'participant_type', ''));
      v_category_price := coalesce((v_category->>'price')::numeric, 0);
      v_category_min := coalesce((v_category->>'min_participants')::integer, 0);

      if coalesce(v_category->>'max_participants', '') = '' then
        v_category_max := null;
      else
        v_category_max := (v_category->>'max_participants')::integer;
      end if;

      if coalesce(v_category->>'start_at', '') = '' then
        v_category_start_at := null;
      else
        v_category_start_at := (v_category->>'start_at')::timestamp;
      end if;

      v_category_address := nullif(trim(coalesce(v_category->>'address', '')), '');
      v_category_prizes := nullif(trim(coalesce(v_category->>'prizes', '')), '');

      if v_category_name = '' then
        raise exception 'Category name is required';
      end if;

      if v_category_participant_type_text not in ('individual', 'team') then
        raise exception 'Category participant type is required';
      end if;

      v_category_participant_type := v_category_participant_type_text::public.participant_type;

      if v_category_price < 0 then
        raise exception 'Category price is invalid';
      end if;

      if v_category_min <= 0 then
        raise exception 'Category min participants are invalid';
      end if;

      if v_category_max is not null and v_category_max < v_category_min then
        raise exception 'Category max participants are invalid';
      end if;

      if p_prize_mode = 'per_category'::public.prize_mode and v_category_prizes is null then
        raise exception 'Category prizes are required';
      end if;

      insert into public.categories (
        tournament_id,
        name,
        participant_type,
        price,
        min_participants,
        max_participants,
        start_at,
        address,
        prizes
      )
      values (
        v_tournament_id,
        v_category_name,
        v_category_participant_type,
        v_category_price,
        v_category_min,
        v_category_max,
        v_category_start_at,
        v_category_address,
        v_category_prizes
      );
    end loop;
  end if;

  perform public.publish_tournament(v_tournament_id);

  return v_tournament_id;
end;
$$;

create or replace function public.publish_tournament(p_tournament_id uuid)
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

  if not v_tournament.has_categories then
    if v_tournament.participant_type is null then
      raise exception 'Tournament participant type is required';
    end if;

    if coalesce(v_tournament.entry_price, 0) < 0 then
      raise exception 'Tournament entry price is invalid';
    end if;
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
        or c.participant_type is null
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

create or replace function public.update_tournament_management_config(
  p_tournament_id uuid,
  p_title text,
  p_description text default null,
  p_rules text default null,
  p_province text default null,
  p_address text default null,
  p_date timestamp without time zone default null,
  p_registration_deadline timestamp without time zone default null,
  p_is_public boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_title text;
  v_province text;
  v_address text;
  v_description text;
  v_rules text;
begin
  select *
  into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if auth.uid() is null or auth.uid() <> v_tournament.organizer_id then
    raise exception 'You cannot manage this tournament';
  end if;

  if v_tournament.status <> 'published'::public.tournament_status then
    raise exception 'Only published tournaments can be edited from this panel';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'Title is required';
  end if;

  v_province := trim(coalesce(p_province, ''));
  if v_province = '' then
    raise exception 'Province is required';
  end if;

  v_address := trim(coalesce(p_address, ''));
  if v_address = '' then
    raise exception 'Address is required';
  end if;

  if p_date is null then
    raise exception 'Tournament date is required';
  end if;

  if p_registration_deadline is null then
    raise exception 'Registration deadline is required';
  end if;

  if p_registration_deadline > p_date then
    raise exception 'Registration deadline cannot be after tournament date';
  end if;

  if v_tournament.min_participants <= 0 then
    raise exception 'Tournament min participants are invalid';
  end if;

  if v_tournament.max_participants is not null
     and v_tournament.max_participants < v_tournament.min_participants then
    raise exception 'Tournament max participants are invalid';
  end if;

  if v_tournament.payment_method is null then
    raise exception 'Payment method is required';
  end if;

  if not v_tournament.has_categories then
    if v_tournament.participant_type is null then
      raise exception 'Tournament participant type is required';
    end if;

    if coalesce(v_tournament.entry_price, 0) < 0 then
      raise exception 'Tournament entry price is invalid';
    end if;
  end if;

  if v_tournament.has_categories then
    if not exists (
      select 1
      from public.categories c
      where c.tournament_id = v_tournament.id
    ) then
      raise exception 'At least one category is required';
    end if;

    if exists (
      select 1
      from public.categories c
      where c.tournament_id = v_tournament.id
        and (
          trim(coalesce(c.name, '')) = ''
          or c.participant_type is null
          or c.price < 0
          or c.min_participants <= 0
          or (c.max_participants is not null and c.max_participants < c.min_participants)
        )
    ) then
      raise exception 'Categories contain invalid data';
    end if;
  end if;

  if v_tournament.prize_mode = 'global'::public.prize_mode
     and trim(coalesce(v_tournament.prizes, '')) = '' then
    raise exception 'Global prizes are required';
  end if;

  if v_tournament.prize_mode = 'per_category'::public.prize_mode then
    if exists (
      select 1
      from public.categories c
      where c.tournament_id = v_tournament.id
        and trim(coalesce(c.prizes, '')) = ''
    ) then
      raise exception 'Category prizes are required';
    end if;
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');
  v_rules := nullif(trim(coalesce(p_rules, '')), '');

  update public.tournaments
  set
    title = v_title,
    description = v_description,
    rules = v_rules,
    province = v_province,
    address = v_address,
    date = p_date,
    registration_deadline = p_registration_deadline,
    is_public = coalesce(p_is_public, true)
  where id = v_tournament.id;

  return v_tournament.id;
end;
$$;

drop function if exists public.create_public_registration_request(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
);

create function public.create_public_registration_request(
  p_tournament_id uuid,
  p_display_name text,
  p_contact_phone text,
  p_category_id uuid default null,
  p_contact_email text default null,
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
  v_phone_normalized := public.normalize_phone(v_phone_raw);
  if v_phone_normalized is null then
    raise exception 'Contact phone is required';
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
    expires_at
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
    null
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

grant execute on function public.create_and_publish_tournament(
  text,
  text,
  text,
  text,
  text,
  timestamp without time zone,
  timestamp without time zone,
  boolean,
  boolean,
  public.participant_type,
  integer,
  integer,
  public.payment_method_enum,
  public.prize_mode,
  text,
  text,
  numeric,
  jsonb
) to authenticated, service_role;

grant execute on function public.create_public_registration_request(
  uuid,
  text,
  text,
  uuid,
  text,
  public.registration_payment_method
) to service_role;

commit;
