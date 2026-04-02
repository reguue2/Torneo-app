create or replace function public.create_public_registration(
  p_tournament_id uuid,
  p_participant_type public.participant_type,
  p_display_name text,
  p_contact_phone text,
  p_category_id uuid default null,
  p_contact_email text default null,
  p_players jsonb default null,
  p_payment_method public.registration_payment_method default 'cash'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_category public.categories%rowtype;
  v_participant_id uuid;
  v_registration_id uuid;
  v_amount numeric;
  v_registration_status public.registration_status;
  v_payment_status public.payment_status;
begin
  if trim(coalesce(p_display_name, '')) = '' then
    raise exception 'Display name is required';
  end if;

  if trim(coalesce(p_contact_phone, '')) = '' then
    raise exception 'Contact phone is required';
  end if;

  if p_payment_method <> 'cash'::public.registration_payment_method then
    raise exception 'Only cash registrations are available right now';
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

  if v_tournament.payment_method = 'online'::public.payment_method_enum then
    raise exception 'Online registration is not available right now';
  end if;

  if v_tournament.registration_deadline is not null
     and now() > v_tournament.registration_deadline then
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

    v_amount := v_category.price;
  else
    if p_category_id is not null then
      raise exception 'Category is not allowed for this tournament';
    end if;

    v_amount := v_tournament.entry_price;
  end if;

  v_registration_status :=
    case
      when coalesce(v_amount, 0) <= 0 then 'paid'::public.registration_status
      else 'pending'::public.registration_status
    end;

  v_payment_status :=
    case
      when coalesce(v_amount, 0) <= 0 then 'paid'::public.payment_status
      else 'pending'::public.payment_status
    end;

  insert into public.participants (
    type,
    display_name,
    contact_phone,
    contact_email,
    players
  )
  values (
    p_participant_type,
    trim(p_display_name),
    trim(p_contact_phone),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    p_players
  )
  returning id into v_participant_id;

  if v_tournament.has_categories then
    insert into public.registrations (
      category_id,
      participant_id,
      status,
      payment_method
    )
    values (
      p_category_id,
      v_participant_id,
      v_registration_status,
      'cash'::public.registration_payment_method
    )
    returning id into v_registration_id;
  else
    insert into public.registrations (
      tournament_id,
      participant_id,
      status,
      payment_method
    )
    values (
      p_tournament_id,
      v_participant_id,
      v_registration_status,
      'cash'::public.registration_payment_method
    )
    returning id into v_registration_id;
  end if;

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
    'cash'::public.registration_payment_method,
    v_payment_status,
    case
      when v_payment_status = 'paid'::public.payment_status then now()
      else null
    end
  );

  return v_registration_id;
end;
$$;

grant execute on function public.create_public_registration(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) to anon;

grant execute on function public.create_public_registration(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) to authenticated;

grant execute on function public.create_public_registration(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) to service_role;