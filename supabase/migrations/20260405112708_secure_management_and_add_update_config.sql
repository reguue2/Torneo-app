begin;

revoke execute on function public.cleanup_old_drafts(integer) from anon, authenticated;

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
) returns uuid
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

  if v_tournament.status = 'draft'::public.tournament_status then
    raise exception 'Draft tournaments must be managed from the creation flow';
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

grant execute on function public.update_tournament_management_config(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamp without time zone,
  timestamp without time zone,
  boolean
) to authenticated, service_role;

commit;