-- 0003_profile_trigger.sql
-- Creates a `profiles` row automatically whenever a new Supabase Auth user
-- is created (email/password or Google OAuth alike), so the rest of the
-- app can always assume `profiles.id = auth.uid()` exists for a logged-in
-- user instead of null-checking it everywhere.

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
