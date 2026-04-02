begin;

create or replace function public.apply_automatic_state_transitions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished_tournaments integer := 0;
  v_closed_tournaments integer := 0;
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

  return jsonb_build_object(
    'finished_tournaments', v_finished_tournaments,
    'closed_tournaments', v_closed_tournaments
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
  v_deadline timestamp;
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
    raise exception 'Draft tournaments must be managed from the creation flow';
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

create or replace function public.mark_cash_registration_paid(
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

  if v_registration.payment_method <> 'cash'::public.registration_payment_method then
    raise exception 'Only cash registrations can be marked as paid manually';
  end if;

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Only pending registrations can be marked as paid';
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
  set status = 'paid'::public.registration_status
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
      'cash'::public.registration_payment_method,
      'paid'::public.payment_status,
      now()
    );
  end if;

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'status', 'paid',
    'amount', coalesce(v_amount, 0)
  );
end;
$$;

create or replace function public.cancel_pending_registration_by_organizer(
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
  v_category public.categories%rowtype;
  v_tournament_id uuid;
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

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Only pending registrations can be cancelled';
  end if;

  update public.registrations
  set status = 'cancelled'::public.registration_status
  where id = v_registration.id;

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'status', 'cancelled'
  );
end;
$$;

grant execute on function public.apply_automatic_state_transitions() to anon, authenticated, service_role;
grant execute on function public.set_tournament_management_status(uuid, public.tournament_status) to authenticated, service_role;
grant execute on function public.mark_cash_registration_paid(uuid) to authenticated, service_role;
grant execute on function public.cancel_pending_registration_by_organizer(uuid) to authenticated, service_role;

commit;