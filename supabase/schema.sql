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
-- 2. Security: only signed-in team members can use the data
------------------------------------------------------------

alter table public.hospital_calls enable row level security;
alter table public.call_answers   enable row level security;

-- Everyone on the team can read every call.
drop policy if exists "team reads calls" on public.hospital_calls;
create policy "team reads calls" on public.hospital_calls
  for select to authenticated using (true);

-- A person can only add calls as themselves.
drop policy if exists "team adds own calls" on public.hospital_calls;
create policy "team adds own calls" on public.hospital_calls
  for insert to authenticated with check (created_by = auth.uid());

-- A person can delete only their own calls.
drop policy if exists "owner deletes own calls" on public.hospital_calls;
create policy "owner deletes own calls" on public.hospital_calls
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists "team reads answers" on public.call_answers;
create policy "team reads answers" on public.call_answers
  for select to authenticated using (true);

drop policy if exists "team adds answers to own calls" on public.call_answers;
create policy "team adds answers to own calls" on public.call_answers
  for insert to authenticated
  with check (exists (
    select 1 from public.hospital_calls c
    where c.id = call_id and c.created_by = auth.uid()
  ));

------------------------------------------------------------
-- 3. submit_call: saves one call and its answers in one step
------------------------------------------------------------
-- The app calls this. If the same call is sent twice, the second time just
-- returns the existing row, so resending from the phone never creates duplicates.

create or replace function public.submit_call(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  a    jsonb;
begin
  select id into v_id from public.hospital_calls where client_id = payload ->> 'client_id';
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
  returning id into v_id;

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
