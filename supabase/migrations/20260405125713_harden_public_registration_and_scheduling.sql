begin;

create or replace function public.prevent_tournament_entry_price_change_after_registration()
returns trigger
language plpgsql
as $$
declare
  reg_count integer;
begin
  select count(*)
  into reg_count
  from public.registrations
  where tournament_id = old.id
    and status <> 'cancelled'::public.registration_status
    and status <> 'expired'::public.registration_status;

  if reg_count > 0 and coalesce(new.entry_price, 0) <> coalesce(old.entry_price, 0) then
    raise exception 'Cannot change entry price after registrations exist';
  end if;

  return new;
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

  if not v_tournament.has_categories and coalesce(v_tournament.entry_price, 0) < 0 then
    raise exception 'Tournament entry price is invalid';
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

create or replace function public.approve_cash_registration(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_tournament public.tournaments%rowtype;
  v_payment public.payments%rowtype;
  v_amount numeric := 0;
begin
  select *
  into v_registration
  from public.registrations
  where id = p_registration_id;

  if not found then
    raise exception 'Registration not found';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = v_registration.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if auth.uid() is null or auth.uid() <> v_tournament.organizer_id then
    raise exception 'You cannot manage this registration';
  end if;

  if v_registration.payment_method <> 'cash'::public.registration_payment_method then
    raise exception 'Only cash registrations can be approved manually';
  end if;

  if v_registration.status not in (
    'pending_cash_validation'::public.registration_status,
    'pending'::public.registration_status
  ) then
    raise exception 'Registration is not waiting for cash validation';
  end if;

  if v_tournament.status not in (
    'published'::public.tournament_status,
    'closed'::public.tournament_status
  ) then
    raise exception 'Tournament status does not allow cash approvals';
  end if;

  if v_tournament.date is not null and v_tournament.date <= now() then
    raise exception 'Tournament already started';
  end if;

  if v_registration.category_id is not null then
    select coalesce(c.price, 0)
    into v_amount
    from public.categories c
    where c.id = v_registration.category_id;
  else
    select coalesce(t.entry_price, 0)
    into v_amount
    from public.tournaments t
    where t.id = v_registration.tournament_id;
  end if;

  update public.registrations
  set status = 'confirmed'::public.registration_status
  where id = v_registration.id;

  select *
  into v_payment
  from public.payments
  where registration_id = v_registration.id
  order by created_at asc nulls last
  limit 1;

  if found then
    update public.payments
    set
      amount = coalesce(v_amount, 0),
      payment_method = 'cash'::public.registration_payment_method,
      status = 'paid'::public.payment_status,
      paid_at = coalesce(v_payment.paid_at, now())
    where id = v_payment.id;
  else
    insert into public.payments (
      registration_id,
      amount,
      payment_method,
      status,
      paid_at
    )
    values (
      v_registration.id,
      coalesce(v_amount, 0),
      'cash'::public.registration_payment_method,
      'paid'::public.payment_status,
      now()
    );
  end if;

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'status', 'confirmed',
    'payment_status', 'paid',
    'amount', coalesce(v_amount, 0)
  );
end;
$$;

create or replace function public.mark_online_registration_paid(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_tournament public.tournaments%rowtype;
  v_category public.categories%rowtype;
  v_payment public.payments%rowtype;
  v_tournament_id uuid;
  v_amount numeric := 0;
begin
  select *
  into v_registration
  from public.registrations
  where id = p_registration_id;

  if not found then
    raise exception 'Registration not found';
  end if;

  if v_registration.tournament_id is not null then
    v_tournament_id := v_registration.tournament_id;
  elsif v_registration.category_id is not null then
    select *
    into v_category
    from public.categories
    where id = v_registration.category_id;

    if not found then
      raise exception 'Category not found';
    end if;

    v_tournament_id := v_category.tournament_id;
  else
    raise exception 'Registration is not linked to a tournament';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = v_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if auth.uid() is null or auth.uid() <> v_tournament.organizer_id then
    raise exception 'You cannot manage this registration';
  end if;

  if v_registration.payment_method <> 'online'::public.registration_payment_method then
    raise exception 'Only online registrations can be marked as paid manually';
  end if;

  if v_registration.status <> 'pending_online_payment'::public.registration_status then
    raise exception 'Only online pending registrations can be marked as paid';
  end if;

  if v_tournament.status not in (
    'published'::public.tournament_status,
    'closed'::public.tournament_status
  ) then
    raise exception 'Tournament status does not allow online confirmations';
  end if;

  if v_tournament.date is not null and v_tournament.date <= now() then
    raise exception 'Tournament already started';
  end if;

  if v_registration.category_id is not null then
    if v_category.id is null then
      select *
      into v_category
      from public.categories
      where id = v_registration.category_id;
    end if;

    v_amount := coalesce(v_category.price, 0);
  else
    v_amount := coalesce(v_tournament.entry_price, 0);
  end if;

  update public.registrations
  set status = 'confirmed'::public.registration_status
  where id = v_registration.id;

  select *
  into v_payment
  from public.payments
  where registration_id = v_registration.id
  order by created_at asc nulls last
  limit 1;

  if found then
    update public.payments
    set
      amount = coalesce(v_amount, 0),
      payment_method = 'online'::public.registration_payment_method,
      status = 'paid'::public.payment_status,
      paid_at = now()
    where id = v_payment.id;
  else
    insert into public.payments (
      registration_id,
      amount,
      payment_method,
      status,
      paid_at
    )
    values (
      v_registration.id,
      coalesce(v_amount, 0),
      'online'::public.registration_payment_method,
      'paid'::public.payment_status,
      now()
    );
  end if;

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'status', 'confirmed',
    'amount', coalesce(v_amount, 0)
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
  v_tournament public.tournaments%rowtype;
  v_payment public.payments%rowtype;
begin
  select *
  into v_registration
  from public.registrations
  where public_reference = trim(coalesce(p_public_reference, ''));

  if not found then
    raise exception 'Registration not found';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = v_registration.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_registration.status = 'cancelled'::public.registration_status then
    return jsonb_build_object(
      'already_cancelled', true,
      'public_reference', v_registration.public_reference,
      'status', v_registration.status
    );
  end if;

  if v_tournament.status in (
    'finished'::public.tournament_status,
    'cancelled'::public.tournament_status
  ) then
    raise exception 'Finished or cancelled tournaments cannot be changed';
  end if;

  if v_tournament.registration_deadline is not null and now() > v_tournament.registration_deadline then
    raise exception 'Public cancellation deadline passed';
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

create or replace function public.cancel_registration_by_organizer(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_tournament public.tournaments%rowtype;
  v_payment public.payments%rowtype;
begin
  select *
  into v_registration
  from public.registrations
  where id = p_registration_id;

  if not found then
    raise exception 'Registration not found';
  end if;

  select *
  into v_tournament
  from public.tournaments
  where id = v_registration.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if auth.uid() is null or auth.uid() <> v_tournament.organizer_id then
    raise exception 'You cannot manage this registration';
  end if;

  if v_registration.status = 'cancelled'::public.registration_status then
    return jsonb_build_object(
      'already_cancelled', true,
      'registration_id', v_registration.id,
      'status', v_registration.status
    );
  end if;

  if v_registration.status = 'expired'::public.registration_status then
    raise exception 'Expired registrations cannot be changed';
  end if;

  if v_tournament.status in (
    'finished'::public.tournament_status,
    'cancelled'::public.tournament_status
  ) then
    raise exception 'Finished or cancelled tournaments cannot be changed';
  end if;

  if v_tournament.date is not null and v_tournament.date <= now() then
    raise exception 'Only registrations before tournament start can be cancelled';
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

  if found and v_payment.status = 'paid'::public.payment_status then
    update public.payments
    set status = 'refunded'::public.payment_status
    where id = v_payment.id;
  end if;

  return jsonb_build_object(
    'already_cancelled', false,
    'registration_id', v_registration.id,
    'status', 'cancelled'
  );
end;
$$;

create or replace function public.apply_automatic_state_transitions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished_tournaments integer := 0;
  v_closed_tournaments integer := 0;
  v_expired_online_registrations integer := 0;
  v_deleted_open_requests integer := 0;
  v_deleted_consumed_requests integer := 0;
begin
  update public.tournaments
  set status = 'finished'::public.tournament_status
  where status in ('published'::public.tournament_status, 'closed'::public.tournament_status)
    and date is not null
    and date < now();

  get diagnostics v_finished_tournaments = row_count;

  update public.tournaments
  set status = 'closed'::public.tournament_status
  where status = 'published'::public.tournament_status
    and (date is null or date >= now())
    and registration_deadline is not null
    and registration_deadline < now();

  get diagnostics v_closed_tournaments = row_count;

  update public.registrations r
  set status = 'expired'::public.registration_status
  from public.tournaments t
  where r.tournament_id = t.id
    and r.status = 'pending_online_payment'::public.registration_status
    and (
      t.status in (
        'closed'::public.tournament_status,
        'finished'::public.tournament_status,
        'cancelled'::public.tournament_status
      )
      or (t.registration_deadline is not null and t.registration_deadline < now())
      or (t.date is not null and t.date < now())
    );

  get diagnostics v_expired_online_registrations = row_count;

  update public.registrations r
  set status = 'expired'::public.registration_status
  from public.tournaments t
  where r.tournament_id = t.id
    and r.status in (
      'pending_cash_validation'::public.registration_status,
      'pending'::public.registration_status
    )
    and (
      t.status in (
        'finished'::public.tournament_status,
        'cancelled'::public.tournament_status
      )
      or (t.date is not null and t.date < now())
    );

  delete from public.registration_requests
  where consumed_at is null
    and expires_at < now() - interval '24 hours';

  get diagnostics v_deleted_open_requests = row_count;

  delete from public.registration_requests
  where consumed_at is not null
    and consumed_at < now() - interval '14 days';

  get diagnostics v_deleted_consumed_requests = row_count;

  return jsonb_build_object(
    'finished_tournaments', v_finished_tournaments,
    'closed_tournaments', v_closed_tournaments,
    'expired_online_registrations', v_expired_online_registrations,
    'deleted_open_requests', v_deleted_open_requests,
    'deleted_consumed_requests', v_deleted_consumed_requests
  );
end;
$$;

create or replace function public.run_tournament_automation_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.apply_automatic_state_transitions();
end;
$$;

drop function if exists public.cancel_pending_registration_by_organizer(uuid);
drop function if exists public.mark_cash_registration_paid(uuid);

revoke execute on function public.create_public_registration_request(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) from anon, authenticated;

grant execute on function public.create_public_registration_request(
  uuid,
  public.participant_type,
  text,
  text,
  uuid,
  text,
  jsonb,
  public.registration_payment_method
) to service_role;

grant execute on function public.verify_public_registration_request(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.cancel_public_registration(text, text, text) to anon, authenticated, service_role;
grant execute on function public.run_tournament_automation_job() to service_role;

drop policy if exists "Public can view visible tournaments" on public.tournaments;
drop policy if exists "Public can view categories of visible tournaments" on public.categories;

drop policy if exists "Organizer can publish own tournament" on public.tournaments;
drop policy if exists "Update own tournaments" on public.tournaments;
drop policy if exists "Update own categories" on public.categories;
drop policy if exists "Organizer can update own payments" on public.payments;
drop policy if exists "Organizer can update own registrations" on public.registrations;
drop policy if exists "Organizer can update participants of own tournaments" on public.participants;

create policy "Public can view visible tournaments"
on public.tournaments
for select
to anon, authenticated
using (
  status = any (
    array[
      'published'::public.tournament_status,
      'closed'::public.tournament_status,
      'finished'::public.tournament_status,
      'cancelled'::public.tournament_status
    ]
  )
);

create policy "Public can view categories of visible tournaments"
on public.categories
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = categories.tournament_id
      and t.status = any (
        array[
          'published'::public.tournament_status,
          'closed'::public.tournament_status,
          'finished'::public.tournament_status,
          'cancelled'::public.tournament_status
        ]
      )
  )
);

revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.tournaments from anon, authenticated;
revoke insert, update, delete on public.registrations from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.participants from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.tournaments to anon, authenticated;
grant select on public.registrations to authenticated;
grant select on public.payments to authenticated;
grant select on public.participants to authenticated;

drop trigger if exists check_tournament_entry_price_before_update on public.tournaments;
create trigger check_tournament_entry_price_before_update
before update of entry_price on public.tournaments
for each row
execute function public.prevent_tournament_entry_price_change_after_registration();

commit;