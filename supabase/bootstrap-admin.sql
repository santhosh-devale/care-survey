-- One-time setup: replace the email below with the existing Supabase Auth
-- account that should be the first CARE Forms Survey administrator.
do $$
declare
  admin_email text := lower(trim('santhosh.rao@egovernments.org'));
begin
  if admin_email = 'your_admin_email' then
    raise exception 'Replace YOUR_ADMIN_EMAIL with the administrator account email before running this script';
  end if;

  if not exists (select 1 from auth.users where lower(email) = admin_email) then
    raise exception 'No Supabase Auth account exists with email %', admin_email;
  end if;

  insert into public.user_permissions (
    user_id, email, can_submit_surveys, can_view_reports, can_export, can_manage_users
  )
  select id, lower(email), true, true, true, true
  from auth.users
  where lower(email) = admin_email
  on conflict (user_id) do nothing;
end;
$$;
