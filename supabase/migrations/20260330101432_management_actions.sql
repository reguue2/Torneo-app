begin;

create or replace function public.approve_cash_registration(
  p_registration_id uuid
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

create or replace function public.cancel_registration_by_organizer(
  p_registration_id uuid
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

create or replace function public.set_tournament_management_status(
  p_tournament_id uuid,
  p_next_status public.tournament_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_deadline timestamptz;
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

  if v_tournament.status = 'draft'::public.tournament_status then
    raise exception 'Draft tournaments must be published from the publish flow';
  end if;

  if p_next_status = 'published'::public.tournament_status then
    if v_tournament.status <> 'closed'::public.tournament_status then
      raise exception 'Only closed tournaments can be reopened';
    end if;

    if v_tournament.registration_deadline is not null then
      v_deadline := v_tournament.registration_deadline;
      if v_deadline <= now() then
        raise exception 'Registration deadline already passed';
      end if;
    end if;

  elsif p_next_status = 'closed'::public.tournament_status then
    if v_tournament.status <> 'published'::public.tournament_status then
      raise exception 'Only published tournaments can be closed';
    end if;

  elsif p_next_status = 'finished'::public.tournament_status then
    if v_tournament.status not in (
      'published'::public.tournament_status,
      'closed'::public.tournament_status
    ) then
      raise exception 'Only published or closed tournaments can be finished';
    end if;

  elsif p_next_status = 'cancelled'::public.tournament_status then
    if v_tournament.status not in (
      'published'::public.tournament_status,
      'closed'::public.tournament_status
    ) then
      raise exception 'Only published or closed tournaments can be cancelled';
    end if;

  else
    raise exception 'Unsupported tournament status transition';
  end if;

  update public.tournaments
  set status = p_next_status
  where id = v_tournament.id;

  return v_tournament.id;
end;
$$;

grant execute on function public.approve_cash_registration(uuid) to authenticated, service_role;
grant execute on function public.cancel_registration_by_organizer(uuid) to authenticated, service_role;
grant execute on function public.set_tournament_management_status(uuid, public.tournament_status) to authenticated, service_role;

commit;