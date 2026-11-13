-- =====================================================================
--  Class Celebration Engine — database setup
--  Paste this whole file into the Neon SQL Editor and click Run.
--
--  BEFORE RUNNING: (password set already)
--  with a long random password (letters + digits, 20+ characters).
--  That password goes into config.js. Safe to re-run.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'party_client') then
    execute format('create role party_client login password %L', 'Mukumouli-2026-Party!');
  end if;
end $$;

-- ---------- tables (party_client can NOT touch these directly) ----------
create table if not exists rooms (
  code        text primary key,
  pack_id     text not null,
  host_token  uuid not null default gen_random_uuid(),
  state       jsonb not null default '{}'::jsonb,
  version     int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  secret      uuid not null default gen_random_uuid(),
  room_code   text not null references rooms(code) on delete cascade,
  name        text not null,
  avatar      text not null default '🧬',
  score       int  not null default 0,
  coins       int  not null default 0,
  stamps      jsonb not null default '[]'::jsonb,
  stats       jsonb not null default '{}'::jsonb,
  kicked      boolean not null default false,
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists players_room on players(room_code);

create table if not exists events (
  id          bigserial primary key,
  room_code   text not null references rooms(code) on delete cascade,
  player_id   uuid,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_room_id on events(room_code, id);
create index if not exists events_player_time on events(player_id, created_at);

-- ---------- functions: the ONLY door party_client gets ----------

create or replace function create_room(p_pack text) returns json
language plpgsql security definer set search_path = public as $$
declare v_code text; v_tok uuid; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ'; i int;
begin
  if p_pack !~ '^[a-z0-9_-]{1,40}$' then raise exception 'BAD_PACK'; end if;
  delete from rooms where created_at < now() - interval '3 days';
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;
  insert into rooms(code, pack_id) values (v_code, p_pack) returning host_token into v_tok;
  return json_build_object('code', v_code, 'host_token', v_tok);
end $$;

create or replace function join_room(p_code text, p_name text, p_avatar text, p_player uuid, p_secret uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_secret uuid; v_code text := upper(trim(p_code)); v_name text := left(trim(coalesce(p_name, '')), 24);
begin
  if not exists (select 1 from rooms where code = v_code) then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  if p_player is not null then
    update players set name = v_name, avatar = left(coalesce(p_avatar, 'g:1'), 24), last_seen = now()
     where id = p_player and secret = p_secret and room_code = v_code and not kicked
     returning id, secret into v_id, v_secret;
  end if;
  if v_id is null then
    if (select count(*) from players where room_code = v_code) >= 80 then raise exception 'ROOM_FULL'; end if;
    insert into players(room_code, name, avatar) values (v_code, v_name, left(coalesce(p_avatar, 'g:1'), 24))
      returning id, secret into v_id, v_secret;
  end if;
  return json_build_object('id', v_id, 'secret', v_secret);
end $$;

-- p_since < 0  -> skip events (phones); otherwise events with id > p_since
create or replace function poll(p_code text, p_since bigint, p_player uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_events json; v_max bigint;
begin
  select * into v_room from rooms where code = upper(p_code);
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_player is not null then
    update players set last_seen = now()
     where id = p_player and room_code = v_room.code and last_seen < now() - interval '8 seconds';
  end if;
  select coalesce(max(id), 0) into v_max from events where room_code = v_room.code;
  if p_since >= 0 then
    select coalesce(json_agg(e order by e.id), '[]'::json) into v_events from (
      select id, player_id as p, kind as k, payload as d,
             (extract(epoch from created_at) * 1000)::bigint as t
        from events where room_code = v_room.code and id > p_since
       order by id limit 300) e;
  else
    v_events := '[]'::json;
  end if;
  return json_build_object(
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'max', v_max,
    'room', json_build_object('code', v_room.code, 'pack', v_room.pack_id, 'state', v_room.state, 'version', v_room.version),
    'players', (select coalesce(json_agg(json_build_object(
        'id', id, 'name', name, 'avatar', avatar, 'score', score, 'coins', coins,
        'stamps', stamps, 'stats', stats, 'kicked', kicked,
        'seen', (extract(epoch from last_seen) * 1000)::bigint) order by created_at), '[]'::json)
        from players where room_code = v_room.code),
    'events', v_events);
end $$;

create or replace function send_event(p_code text, p_player uuid, p_secret uuid, p_kind text, p_payload jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(p_code); v_id bigint;
begin
  if not exists (select 1 from players where id = p_player and secret = p_secret and room_code = v_code and not kicked) then
    raise exception 'NOT_IN_ROOM';
  end if;
  if p_kind !~ '^[a-z0-9_-]{1,24}$' then raise exception 'BAD_KIND'; end if;
  if length(p_payload::text) > 2000 then raise exception 'TOO_BIG'; end if;
  if (select count(*) from events where player_id = p_player and created_at > now() - interval '2 seconds') >= 8 then
    return json_build_object('ok', false, 'limited', true);
  end if;
  insert into events(room_code, player_id, kind, payload) values (v_code, p_player, p_kind, coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function host_set_state(p_code text, p_token uuid, p_state jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare v_version int;
begin
  if length(p_state::text) > 400000 then raise exception 'STATE_TOO_BIG'; end if;
  update rooms set state = p_state, version = version + 1
   where code = upper(p_code) and host_token = p_token
   returning version into v_version;
  if v_version is null then raise exception 'NOT_HOST'; end if;
  return json_build_object('version', v_version);
end $$;

-- p_awards: [{ "id": uuid, "points": int, "coins": int, "stamp": text, "stats": {"key": n} }]
create or replace function host_award(p_code text, p_token uuid, p_awards jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(p_code); a jsonb;
begin
  if not exists (select 1 from rooms where code = v_code and host_token = p_token) then raise exception 'NOT_HOST'; end if;
  for a in select value from jsonb_array_elements(p_awards) loop
    update players p set
      score  = greatest(0, p.score + coalesce((a->>'points')::int, 0)),
      coins  = greatest(0, p.coins + coalesce((a->>'coins')::int, 0)),
      stamps = case when a ? 'stamp' and not (p.stamps @> jsonb_build_array(a->>'stamp'))
                    then p.stamps || jsonb_build_array(a->>'stamp') else p.stamps end,
      stats  = case when a ? 'stats' then (
                 select coalesce(jsonb_object_agg(k, coalesce((p.stats->>k)::numeric, 0) + coalesce((a->'stats'->>k)::numeric, 0)), '{}'::jsonb)
                   from (select jsonb_object_keys(p.stats) as k union select jsonb_object_keys(a->'stats')) ks)
               else p.stats end
     where p.id = (a->>'id')::uuid and p.room_code = v_code;
  end loop;
  return json_build_object('ok', true);
end $$;

create or replace function host_kick(p_code text, p_token uuid, p_player uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where code = upper(p_code) and host_token = p_token) then raise exception 'NOT_HOST'; end if;
  update players set kicked = true where id = p_player and room_code = upper(p_code);
  return json_build_object('ok', true);
end $$;

-- ---------- lock it down ----------
revoke all on all tables in schema public from party_client;
revoke all on all sequences in schema public from party_client;
revoke execute on all functions in schema public from public;
grant usage on schema public to party_client;
grant execute on function
  create_room(text),
  join_room(text, text, text, uuid, uuid),
  poll(text, bigint, uuid),
  send_event(text, uuid, uuid, text, jsonb),
  host_set_state(text, uuid, jsonb),
  host_award(text, uuid, jsonb),
  host_kick(text, uuid, uuid)
to party_client;
