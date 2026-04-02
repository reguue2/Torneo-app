begin;

create or replace function public.create_and_publish_tournament(
  p_title text,
  p_description text,
  p_poster_url text,
  p_province text,
  p_address text,
  p_date timestamp without time zone,
  p_registration_deadline timestamp without time zone,
  p_is_public boolean,
  p_has_categories boolean,
  p_min_participants integer,
  p_max_participants integer,
  p_payment_method public.payment_method_enum,
  p_prize_mode public.prize_mode,
  p_prizes text,
  p_rules text,
  p_entry_price numeric,
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
  v_category_price numeric;
  v_category_min integer;
  v_category_max integer;
  v_category_start_at timestamp without time zone;
  v_category_address text;
  v_category_prizes text;
begin
  if auth.uid() is null then
    raise exception 'You must be authenticated';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required';
  end if;

  if trim(coalesce(p_poster_url, '')) = '' then
    raise exception 'Poster is required';
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
    if p_categories is null or jsonb_typeof(p_categories) <> 'array' then
      raise exception 'Categories payload is invalid';
    end if;

    if jsonb_array_length(p_categories) < 2 then
      raise exception 'At least 2 categories are required';
    end if;

    if p_prize_mode = 'global'::public.prize_mode and trim(coalesce(p_prizes, '')) = '' then
      raise exception 'Global prizes are required';
    end if;
  else
    if p_categories is not null and jsonb_typeof(p_categories) = 'array' and jsonb_array_length(p_categories) > 0 then
      raise exception 'Categories are not allowed for this tournament';
    end if;

    if coalesce(p_entry_price, 0) < 0 then
      raise exception 'Tournament entry price is invalid';
    end if;

    if p_prize_mode = 'global'::public.prize_mode and trim(coalesce(p_prizes, '')) = '' then
      raise exception 'Global prizes are required';
    end if;

    if p_prize_mode = 'per_category'::public.prize_mode then
      raise exception 'Per-category prizes require categories';
    end if;
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
  integer,
  integer,
  public.payment_method_enum,
  public.prize_mode,
  text,
  text,
  numeric,
  jsonb
) to authenticated, service_role;

commit;