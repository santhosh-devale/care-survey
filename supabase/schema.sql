-- CARE Forms Survey: Supabase schema
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It is safe to read top to bottom: tables, then security rules, then one function.

------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------

-- One row per hospital call.
create table if not exists public.hospital_calls (
  id                uuid primary key default gen_random_uuid(),
  client_id         text not null unique,   -- id made by the app; makes resending a call safe
  created_by        uuid not null default auth.uid() references auth.users (id),
  created_at        timestamptz not null default now(),
  called_at         timestamptz,
  caller_name       text not null,
  caller_role       text not null,
  hospital          text not null,
  district          text,
  spoke_to          text not null,
  designation       text,
  phone             text,
  parts_yes         int  not null,
  parts_applicable  int  not null,
  percent           int  not null,
  rating            text not null check (rating in ('Compliant', 'Needs follow-up', 'Escalate')),
  overall_result    text not null check (overall_result in ('Started', 'Partly', 'Not started')),
  responsible       text,
  help_needed       boolean,
  help_for          text,
  follow_up         date,
  remarks           text
);

-- One row per form part per call (16 rows for a full call).
create table if not exists public.call_answers (
  call_id      uuid not null references public.hospital_calls (id) on delete cascade,
  part_id      text not null,
  part_num     text not null,
  part_title   text not null,
  filling      boolean not null,           -- true = Yes, false = No
  reason_code  text check (reason_code in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8')),
  remarks      text,
  primary key (call_id, part_id)
);

create index if not exists hospital_calls_hospital_idx on public.hospital_calls (lower(hospital));
create index if not exists hospital_calls_district_idx on public.hospital_calls (district);
create index if not exists hospital_calls_called_at_idx on public.hospital_calls (called_at desc);

------------------------------------------------------------
-- 2. Security: signed-in users need explicit app permissions
------------------------------------------------------------

-- A Supabase Auth account has no app access until an administrator assigns
-- one or more permissions here.
create table if not exists public.user_permissions (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  email               text not null unique,
  can_submit_surveys  boolean not null default false,
  can_view_reports    boolean not null default false,
  can_export          boolean not null default false,
  can_manage_users    boolean not null default false,
  updated_at          timestamptz not null default now()
);

alter table public.user_permissions enable row level security;

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce((
    select case permission_name
      when 'submit_surveys' then can_submit_surveys
      when 'view_reports' then can_view_reports
      when 'export' then can_export
      when 'manage_users' then can_manage_users
      else false
    end
    from public.user_permissions
    where user_id = auth.uid()
  ), false);
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

drop policy if exists "users read own permissions or admins read all" on public.user_permissions;
create policy "users read own permissions or admins read all" on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('manage_users'));

-- Permissions can only be changed through the checked admin RPC below.
revoke all on public.user_permissions from anon, authenticated;
grant select on public.user_permissions to authenticated;

create or replace function public.set_user_permissions(
  target_email text,
  allow_submit_surveys boolean,
  allow_view_reports boolean,
  allow_export boolean,
  allow_manage_users boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  target_user_id uuid;
  current_admin_count integer;
begin
  if auth.uid() is null or not public.has_permission('manage_users') then
    raise exception 'You do not have permission to manage users';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(target_email));

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists with that email';
  end if;

  if not allow_manage_users then
    select count(*) into current_admin_count
    from public.user_permissions
    where can_manage_users;

    if current_admin_count <= 1 and exists (
      select 1 from public.user_permissions
      where user_id = target_user_id and can_manage_users
    ) then
      raise exception 'At least one user must keep user-management permission';
    end if;
  end if;

  insert into public.user_permissions (
    user_id, email, can_submit_surveys, can_view_reports, can_export, can_manage_users, updated_at
  )
  select
    id, lower(email), allow_submit_surveys, allow_view_reports, allow_export, allow_manage_users, now()
  from auth.users
  where id = target_user_id
  on conflict (user_id) do update set
    email = excluded.email,
    can_submit_surveys = excluded.can_submit_surveys,
    can_view_reports = excluded.can_view_reports,
    can_export = excluded.can_export,
    can_manage_users = excluded.can_manage_users,
    updated_at = now();
end;
$$;

revoke all on function public.set_user_permissions(text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_user_permissions(text, boolean, boolean, boolean, boolean) to authenticated;

alter table public.hospital_calls enable row level security;
alter table public.call_answers   enable row level security;

drop policy if exists "team reads calls" on public.hospital_calls;
drop policy if exists "team adds own calls" on public.hospital_calls;
drop policy if exists "owner deletes own calls" on public.hospital_calls;
drop policy if exists "team reads answers" on public.call_answers;
drop policy if exists "team adds answers to own calls" on public.call_answers;
drop policy if exists "permitted users read calls" on public.hospital_calls;
create policy "permitted users read calls" on public.hospital_calls
  for select to authenticated
  using (public.has_permission('view_reports') or public.has_permission('export'));

drop policy if exists "permitted users read answers" on public.call_answers;
create policy "permitted users read answers" on public.call_answers
  for select to authenticated
  using (public.has_permission('view_reports') or public.has_permission('export'));

revoke all on public.hospital_calls, public.call_answers from anon, authenticated;
grant select on public.hospital_calls, public.call_answers to authenticated;

------------------------------------------------------------
-- 3. submit_call: saves one call and its answers in one step
------------------------------------------------------------
-- The app calls this. If the same call is sent twice, the second time just
-- returns the existing row, so resending from the phone never creates duplicates.

create or replace function public.submit_call(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_id uuid;
  a    jsonb;
begin
  if auth.uid() is null or not public.has_permission('submit_surveys') then
    raise exception 'You do not have permission to submit surveys';
  end if;

  select id into v_id
  from public.hospital_calls
  where client_id = payload ->> 'client_id' and created_by = auth.uid();
  if v_id is not null then
    return v_id;
  end if;

  insert into public.hospital_calls (
    client_id, called_at, caller_name, caller_role, hospital, district, spoke_to,
    designation, phone, parts_yes, parts_applicable, percent, rating, overall_result,
    responsible, help_needed, help_for, follow_up, remarks
  ) values (
    payload ->> 'client_id',
    nullif(payload ->> 'called_at', '')::timestamptz,
    payload ->> 'caller_name',
    payload ->> 'caller_role',
    payload ->> 'hospital',
    nullif(payload ->> 'district', ''),
    payload ->> 'spoke_to',
    nullif(payload ->> 'designation', ''),
    nullif(payload ->> 'phone', ''),
    (payload ->> 'parts_yes')::int,
    (payload ->> 'parts_applicable')::int,
    (payload ->> 'percent')::int,
    payload ->> 'rating',
    payload ->> 'overall_result',
    nullif(payload ->> 'responsible', ''),
    (payload ->> 'help_needed')::boolean,
    nullif(payload ->> 'help_for', ''),
    nullif(payload ->> 'follow_up', '')::date,
    nullif(payload ->> 'remarks', '')
  )
  on conflict (client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.hospital_calls
    where client_id = payload ->> 'client_id' and created_by = auth.uid();
    if v_id is null then
      raise exception 'This call ID belongs to another user';
    end if;
    return v_id;
  end if;

  for a in select * from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb))
  loop
    insert into public.call_answers (call_id, part_id, part_num, part_title, filling, reason_code, remarks)
    values (
      v_id,
      a ->> 'part_id',
      a ->> 'part_num',
      a ->> 'part_title',
      (a ->> 'filling')::boolean,
      nullif(a ->> 'reason_code', ''),
      nullif(a ->> 'remarks', '')
    );
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.submit_call(jsonb) from public, anon;
grant  execute on function public.submit_call(jsonb) to authenticated;

------------------------------------------------------------
-- 4. A flat view for reports (also handy for Metabase or Excel)
------------------------------------------------------------
-- security_invoker makes the view obey the same rules as the tables above.

create or replace view public.v_answers_flat
with (security_invoker = true) as
select
  c.id            as call_id,
  c.called_at,
  c.hospital,
  c.district,
  c.caller_name,
  c.rating,
  c.overall_result,
  a.part_num,
  a.part_title,
  case when a.filling then 'Yes' else 'No' end as filling,
  a.reason_code,
  a.remarks
from public.call_answers a
join public.hospital_calls c on c.id = a.call_id;

revoke all on public.v_answers_flat from anon, authenticated;
grant select on public.v_answers_flat to authenticated;
