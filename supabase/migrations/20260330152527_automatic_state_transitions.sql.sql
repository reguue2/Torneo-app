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
  v_expired_online_registrations integer := 0;
  v_deleted_open_requests integer := 0;
  v_deleted_consumed_requests integer := 0;
begin
  update public.tournaments
  set status = 'finished'::public.tournament_status
  where status in (
    'published'::public.tournament_status,
    'closed'::public.tournament_status
  )
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

grant execute on function public.apply_automatic_state_transitions()
to anon, authenticated, service_role;

commit;