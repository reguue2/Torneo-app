


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."participant_type" AS ENUM (
    'individual',
    'team'
);


ALTER TYPE "public"."participant_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method_enum" AS ENUM (
    'cash',
    'online',
    'both'
);


ALTER TYPE "public"."payment_method_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."prize_mode" AS ENUM (
    'none',
    'global',
    'per_category'
);


ALTER TYPE "public"."prize_mode" OWNER TO "postgres";


CREATE TYPE "public"."registration_payment_method" AS ENUM (
    'cash',
    'online'
);


ALTER TYPE "public"."registration_payment_method" OWNER TO "postgres";


CREATE TYPE "public"."registration_status" AS ENUM (
    'pending',
    'paid',
    'cancelled',
    'pending_verification',
    'pending_cash_validation',
    'pending_online_payment',
    'confirmed',
    'expired'
);


ALTER TYPE "public"."registration_status" OWNER TO "postgres";


CREATE TYPE "public"."tournament_status" AS ENUM (
    'draft',
    'published',
    'closed',
    'finished',
    'cancelled'
);


ALTER TYPE "public"."tournament_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_automatic_state_transitions"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_automatic_state_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_cash_registration"("p_registration_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."approve_cash_registration"("p_registration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_public_registration"("p_public_reference" "text", "p_cancel_code" "text" DEFAULT NULL::"text", "p_cancel_token" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_public_registration"("p_public_reference" "text", "p_cancel_code" "text", "p_cancel_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_registration_by_organizer"("p_registration_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_registration_by_organizer"("p_registration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_registration_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."check_registration_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_drafts"("days_old" integer DEFAULT 7) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  n int;
begin
  delete from public.tournaments
  where status = 'draft'
    and updated_at < now() - (days_old || ' days')::interval;

  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."cleanup_old_drafts"("days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_and_publish_tournament"("p_title" "text", "p_description" "text", "p_poster_url" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean, "p_has_categories" boolean, "p_participant_type" "public"."participant_type" DEFAULT NULL::"public"."participant_type", "p_min_participants" integer DEFAULT 1, "p_max_participants" integer DEFAULT NULL::integer, "p_payment_method" "public"."payment_method_enum" DEFAULT NULL::"public"."payment_method_enum", "p_prize_mode" "public"."prize_mode" DEFAULT 'none'::"public"."prize_mode", "p_prizes" "text" DEFAULT NULL::"text", "p_rules" "text" DEFAULT NULL::"text", "p_entry_price" numeric DEFAULT 0, "p_categories" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_and_publish_tournament"("p_title" "text", "p_description" "text", "p_poster_url" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean, "p_has_categories" boolean, "p_participant_type" "public"."participant_type", "p_min_participants" integer, "p_max_participants" integer, "p_payment_method" "public"."payment_method_enum", "p_prize_mode" "public"."prize_mode", "p_prizes" "text", "p_rules" "text", "p_entry_price" numeric, "p_categories" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_public_registration"("p_tournament_id" "uuid", "p_participant_type" "public"."participant_type", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_contact_email" "text" DEFAULT NULL::"text", "p_players" "jsonb" DEFAULT NULL::"jsonb", "p_payment_method" "public"."registration_payment_method" DEFAULT 'cash'::"public"."registration_payment_method") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_public_registration"("p_tournament_id" "uuid", "p_participant_type" "public"."participant_type", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_players" "jsonb", "p_payment_method" "public"."registration_payment_method") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_public_registration_request"("p_tournament_id" "uuid", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_contact_email" "text" DEFAULT NULL::"text", "p_payment_method" "public"."registration_payment_method" DEFAULT 'cash'::"public"."registration_payment_method") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_public_registration_request"("p_tournament_id" "uuid", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_payment_method" "public"."registration_payment_method") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_public_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."generate_public_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, now());

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_online_registration_paid"("p_registration_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."mark_online_registration_paid"("p_registration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"("p_email" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(lower(trim(coalesce(p_email, ''))), '')
$$;


ALTER FUNCTION "public"."normalize_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_phone"("p_phone" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(regexp_replace(trim(coalesce(p_phone, '')), '\D', '', 'g'), '')
$$;


ALTER FUNCTION "public"."normalize_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_spanish_phone"("p_phone" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
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
$_$;


ALTER FUNCTION "public"."normalize_spanish_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_category_registration_config_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."prevent_category_registration_config_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_price_change_after_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  reg_count integer;
begin

  -- contar inscritos actuales
  select count(*)
  into reg_count
  from registrations
  where category_id = old.id
  and status <> 'cancelled';

  -- si hay inscritos y cambia el precio
  if reg_count > 0 and new.price <> old.price then
    raise exception 'Cannot change price after registrations exist';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."prevent_price_change_after_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_tournament_registration_config_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."prevent_tournament_registration_config_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_tournament"("p_tournament_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."publish_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resend_public_registration_request"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."resend_public_registration_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_tournament_automation_job"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return public.apply_automatic_state_transitions();
end;
$$;


ALTER FUNCTION "public"."run_tournament_automation_job"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tournament_management_status"("p_tournament_id" "uuid", "p_next_status" "public"."tournament_status") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."set_tournament_management_status"("p_tournament_id" "uuid", "p_next_status" "public"."tournament_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sha256_hex"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select encode(extensions.digest(coalesce(p_value, ''), 'sha256'), 'hex')
$$;


ALTER FUNCTION "public"."sha256_hex"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tournament_management_config"("p_tournament_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_rules" "text" DEFAULT NULL::"text", "p_province" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_registration_deadline" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_is_public" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."update_tournament_management_config"("p_tournament_id" "uuid", "p_title" "text", "p_description" "text", "p_rules" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_public_registration_request"("p_request_id" "uuid", "p_verification_code" "text" DEFAULT NULL::"text", "p_verification_token" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."verify_public_registration_request"("p_request_id" "uuid", "p_verification_code" "text", "p_verification_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "min_participants" integer DEFAULT 1 NOT NULL,
    "max_participants" integer,
    "start_at" timestamp without time zone,
    "address" "text",
    "prizes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "participant_type" "public"."participant_type" NOT NULL,
    CONSTRAINT "categories_participants_check" CHECK ((("min_participants" > 0) AND (("max_participants" IS NULL) OR ("max_participants" >= "min_participants"))))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "type" "public"."participant_type" NOT NULL,
    "display_name" "text" NOT NULL,
    "contact_phone" "text" NOT NULL,
    "contact_email" "text",
    "players" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_registration_id" "uuid"
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "registration_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text",
    "payment_method" "public"."registration_payment_method",
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "stripe_payment_intent_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "participant_type" "public"."participant_type" NOT NULL,
    "display_name" "text" NOT NULL,
    "contact_phone" "text" NOT NULL,
    "contact_phone_normalized" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_email_normalized" "text" NOT NULL,
    "players" "jsonb",
    "payment_method" "public"."registration_payment_method" NOT NULL,
    "verification_code_hash" "text" NOT NULL,
    "verification_token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "consumed_at" timestamp with time zone,
    "registration_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resend_count" integer DEFAULT 0 NOT NULL,
    "last_email_sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "registration_requests_display_name_check" CHECK ((TRIM(BOTH FROM "display_name") <> ''::"text"))
);


ALTER TABLE "public"."registration_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_id" "uuid",
    "status" "public"."registration_status" DEFAULT 'pending'::"public"."registration_status",
    "payment_method" "public"."registration_payment_method",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "participant_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "public_reference" "text",
    "contact_email_normalized" "text",
    "contact_phone_normalized" "text",
    "cancel_code_hash" "text",
    "cancel_token_hash" "text",
    "cancelled_at" timestamp with time zone
);


ALTER TABLE "public"."registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "poster_url" "text",
    "prizes" "text",
    "rules" "text",
    "province" "text",
    "address" "text",
    "date" timestamp without time zone,
    "max_participants" integer,
    "registration_deadline" timestamp without time zone,
    "payment_method" "public"."payment_method_enum",
    "is_public" boolean DEFAULT true,
    "status" "public"."tournament_status" DEFAULT 'draft'::"public"."tournament_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_categories" boolean NOT NULL,
    "min_participants" integer DEFAULT 1 NOT NULL,
    "prize_mode" "public"."prize_mode" DEFAULT 'none'::"public"."prize_mode" NOT NULL,
    "entry_price" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "participant_type" "public"."participant_type",
    CONSTRAINT "tournaments_participant_type_consistency_check" CHECK (((("has_categories" = true) AND ("participant_type" IS NULL)) OR (("has_categories" = false) AND ("participant_type" IS NOT NULL)))),
    CONSTRAINT "tournaments_participants_check" CHECK ((("min_participants" > 0) AND (("max_participants" IS NULL) OR ("max_participants" >= "min_participants"))))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "phone" "text",
    "stripe_account_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_source_registration_id_key" UNIQUE ("source_registration_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "registration_requests_lookup_idx" ON "public"."registration_requests" USING "btree" ("tournament_id", "category_id", "contact_email_normalized", "contact_phone_normalized");



CREATE INDEX "registration_requests_open_idx" ON "public"."registration_requests" USING "btree" ("expires_at") WHERE ("consumed_at" IS NULL);



CREATE UNIQUE INDEX "registrations_active_email_unique" ON "public"."registrations" USING "btree" ("tournament_id", COALESCE("category_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "contact_email_normalized") WHERE (("contact_email_normalized" IS NOT NULL) AND ("status" <> ALL (ARRAY['cancelled'::"public"."registration_status", 'expired'::"public"."registration_status"])));



CREATE UNIQUE INDEX "registrations_active_phone_unique" ON "public"."registrations" USING "btree" ("tournament_id", COALESCE("category_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "contact_phone_normalized") WHERE (("contact_phone_normalized" IS NOT NULL) AND ("status" <> ALL (ARRAY['cancelled'::"public"."registration_status", 'expired'::"public"."registration_status"])));



CREATE INDEX "registrations_lookup_email_idx" ON "public"."registrations" USING "btree" ("tournament_id", "category_id", "contact_email_normalized");



CREATE INDEX "registrations_lookup_phone_idx" ON "public"."registrations" USING "btree" ("tournament_id", "category_id", "contact_phone_normalized");



CREATE UNIQUE INDEX "registrations_public_reference_key" ON "public"."registrations" USING "btree" ("public_reference") WHERE ("public_reference" IS NOT NULL);



CREATE OR REPLACE TRIGGER "check_price_before_update" BEFORE UPDATE OF "price" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_price_change_after_registration"();



CREATE OR REPLACE TRIGGER "check_registration_before_insert" BEFORE INSERT ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."check_registration_rules"();



CREATE OR REPLACE TRIGGER "check_tournament_entry_price_before_update" BEFORE UPDATE OF "entry_price" ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"();



CREATE OR REPLACE TRIGGER "prevent_registration_config_change_on_categories" BEFORE UPDATE OF "participant_type" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_category_registration_config_change"();



CREATE OR REPLACE TRIGGER "prevent_registration_config_change_on_tournaments" BEFORE UPDATE OF "has_categories", "participant_type", "payment_method" ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_tournament_registration_config_change"();



CREATE OR REPLACE TRIGGER "set_updated_at_categories" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_tournaments" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Insert own categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "categories"."tournament_id") AND ("tournaments"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Insert own tournaments" ON "public"."tournaments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizer can insert cash payments" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."registrations" "r"
     JOIN "public"."tournaments" "t" ON (((("r"."tournament_id" IS NOT NULL) AND ("t"."id" = "r"."tournament_id")) OR (("r"."category_id" IS NOT NULL) AND ("t"."id" = ( SELECT "c"."tournament_id"
           FROM "public"."categories" "c"
          WHERE ("c"."id" = "r"."category_id")))))))
  WHERE (("r"."id" = "payments"."registration_id") AND ("t"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizer can view participants of own tournaments" ON "public"."participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."registrations" "r"
     JOIN "public"."tournaments" "t" ON (((("r"."tournament_id" IS NOT NULL) AND ("t"."id" = "r"."tournament_id")) OR (("r"."category_id" IS NOT NULL) AND ("t"."id" = ( SELECT "c"."tournament_id"
           FROM "public"."categories" "c"
          WHERE ("c"."id" = "r"."category_id")))))))
  WHERE (("r"."participant_id" = "participants"."id") AND ("t"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Public can view categories of visible tournaments" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "categories"."tournament_id") AND ("t"."status" = ANY (ARRAY['published'::"public"."tournament_status", 'closed'::"public"."tournament_status", 'finished'::"public"."tournament_status", 'cancelled'::"public"."tournament_status"]))))));



CREATE POLICY "Public can view visible tournaments" ON "public"."tournaments" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['published'::"public"."tournament_status", 'closed'::"public"."tournament_status", 'finished'::"public"."tournament_status", 'cancelled'::"public"."tournament_status"])));



CREATE POLICY "Public cannot select participants" ON "public"."participants" FOR SELECT TO "anon" USING (false);



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "View own categories" ON "public"."categories" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "categories"."tournament_id") AND ("tournaments"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "View own payments" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."registrations" "r"
     JOIN "public"."tournaments" "t" ON (((("r"."tournament_id" IS NOT NULL) AND ("t"."id" = "r"."tournament_id")) OR (("r"."category_id" IS NOT NULL) AND ("t"."id" = ( SELECT "c"."tournament_id"
           FROM "public"."categories" "c"
          WHERE ("c"."id" = "r"."category_id")))))))
  WHERE (("r"."id" = "payments"."registration_id") AND ("t"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "View own registrations" ON "public"."registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."organizer_id" = "auth"."uid"()) AND ((("registrations"."tournament_id" IS NOT NULL) AND ("t"."id" = "registrations"."tournament_id")) OR (("registrations"."category_id" IS NOT NULL) AND ("t"."id" = ( SELECT "c"."tournament_id"
           FROM "public"."categories" "c"
          WHERE ("c"."id" = "registrations"."category_id")))))))));



CREATE POLICY "View own tournaments" ON "public"."tournaments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "organizer_id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registration_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_automatic_state_transitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_automatic_state_transitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_automatic_state_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_cash_registration"("p_registration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_cash_registration"("p_registration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_cash_registration"("p_registration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_public_registration"("p_public_reference" "text", "p_cancel_code" "text", "p_cancel_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_public_registration"("p_public_reference" "text", "p_cancel_code" "text", "p_cancel_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_public_registration"("p_public_reference" "text", "p_cancel_code" "text", "p_cancel_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_registration_by_organizer"("p_registration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_registration_by_organizer"("p_registration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_registration_by_organizer"("p_registration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_registration_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_registration_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_registration_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_drafts"("days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_and_publish_tournament"("p_title" "text", "p_description" "text", "p_poster_url" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean, "p_has_categories" boolean, "p_participant_type" "public"."participant_type", "p_min_participants" integer, "p_max_participants" integer, "p_payment_method" "public"."payment_method_enum", "p_prize_mode" "public"."prize_mode", "p_prizes" "text", "p_rules" "text", "p_entry_price" numeric, "p_categories" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_and_publish_tournament"("p_title" "text", "p_description" "text", "p_poster_url" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean, "p_has_categories" boolean, "p_participant_type" "public"."participant_type", "p_min_participants" integer, "p_max_participants" integer, "p_payment_method" "public"."payment_method_enum", "p_prize_mode" "public"."prize_mode", "p_prizes" "text", "p_rules" "text", "p_entry_price" numeric, "p_categories" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_and_publish_tournament"("p_title" "text", "p_description" "text", "p_poster_url" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean, "p_has_categories" boolean, "p_participant_type" "public"."participant_type", "p_min_participants" integer, "p_max_participants" integer, "p_payment_method" "public"."payment_method_enum", "p_prize_mode" "public"."prize_mode", "p_prizes" "text", "p_rules" "text", "p_entry_price" numeric, "p_categories" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_public_registration"("p_tournament_id" "uuid", "p_participant_type" "public"."participant_type", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_players" "jsonb", "p_payment_method" "public"."registration_payment_method") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_public_registration_request"("p_tournament_id" "uuid", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_payment_method" "public"."registration_payment_method") TO "anon";
GRANT ALL ON FUNCTION "public"."create_public_registration_request"("p_tournament_id" "uuid", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_payment_method" "public"."registration_payment_method") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_public_registration_request"("p_tournament_id" "uuid", "p_display_name" "text", "p_contact_phone" "text", "p_category_id" "uuid", "p_contact_email" "text", "p_payment_method" "public"."registration_payment_method") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_public_reference"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_public_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_public_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_online_registration_paid"("p_registration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_online_registration_paid"("p_registration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_online_registration_paid"("p_registration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_spanish_phone"("p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_spanish_phone"("p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_spanish_phone"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_category_registration_config_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_category_registration_config_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_category_registration_config_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_price_change_after_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_price_change_after_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_price_change_after_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_tournament_entry_price_change_after_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_tournament_registration_config_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_tournament_registration_config_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_tournament_registration_config_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_tournament"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."publish_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_tournament"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resend_public_registration_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resend_public_registration_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resend_public_registration_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_tournament_automation_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_tournament_automation_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_tournament_automation_job"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tournament_management_status"("p_tournament_id" "uuid", "p_next_status" "public"."tournament_status") TO "anon";
GRANT ALL ON FUNCTION "public"."set_tournament_management_status"("p_tournament_id" "uuid", "p_next_status" "public"."tournament_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tournament_management_status"("p_tournament_id" "uuid", "p_next_status" "public"."tournament_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sha256_hex"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sha256_hex"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sha256_hex"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tournament_management_config"("p_tournament_id" "uuid", "p_title" "text", "p_description" "text", "p_rules" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_tournament_management_config"("p_tournament_id" "uuid", "p_title" "text", "p_description" "text", "p_rules" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tournament_management_config"("p_tournament_id" "uuid", "p_title" "text", "p_description" "text", "p_rules" "text", "p_province" "text", "p_address" "text", "p_date" timestamp without time zone, "p_registration_deadline" timestamp without time zone, "p_is_public" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_public_registration_request"("p_request_id" "uuid", "p_verification_code" "text", "p_verification_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_public_registration_request"("p_request_id" "uuid", "p_verification_code" "text", "p_verification_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_public_registration_request"("p_request_id" "uuid", "p_verification_code" "text", "p_verification_token" "text") TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "service_role";
GRANT SELECT ON TABLE "public"."participants" TO "anon";
GRANT SELECT ON TABLE "public"."participants" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."registration_requests" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."registrations" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tournaments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







