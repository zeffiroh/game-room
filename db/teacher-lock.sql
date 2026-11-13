-- =====================================================================
--  Game Room: server-side teacher lock (optional, recommended once you sell codes)
--
--  Run AFTER db/schema.sql, in the Neon SQL Editor. Safe to re-run.
--  Then set TEACHER_LOCK = 'neon' in config.js and push.
--
--  After this, the database itself refuses to create a room without a valid code,
--  so nobody can get around the lock from the browser console.
--  If you ever re-run schema.sql, re-run this file right after it.
-- =====================================================================

create table if not exists teacher_codes (
  code_hash   text primary key,             -- sha256('gameroom:' || CODE), CODE = upper case letters/digits only
  label       text not null default '',     -- who bought it: name, school, email, receipt id
  active      boolean not null default true,-- false = revoked
  rooms_made  int not null default 0,
  last_used   timestamptz,
  created_at  timestamptz not null default now()
);

create or replace function teacher_hash(p_code text) returns text
language sql immutable as $$
  select encode(sha256(convert_to('gameroom:' || upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

create or replace function check_teacher(p_code text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from teacher_codes where code_hash = teacher_hash(p_code) and active)
$$;

create or replace function create_room_t(p_pack text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare v_hash text := teacher_hash(p_code);
begin
  if not exists (select 1 from teacher_codes where code_hash = v_hash and active) then
    raise exception 'NOT_TEACHER';
  end if;
  update teacher_codes set rooms_made = rooms_made + 1, last_used = now() where code_hash = v_hash;
  return create_room(p_pack);
end $$;

-- party_client may check codes and create rooms WITH a code, but no longer without one.
revoke all on teacher_codes from party_client;
revoke execute on function create_room(text) from party_client;
revoke execute on function teacher_hash(text) from public;
grant execute on function check_teacher(text), create_room_t(text, text) to party_client;
