-- Creates your house and links both accounts to it. Run once AFTER adding both users in
-- Authentication → Users. Replace the two emails and names below before running.

with h as (
  insert into public.houses (name) values ('Our Home') returning id
)
insert into public.profiles (id, house_id, display_name, role)
select u.id, h.id, v.display_name, v.role
from h
join (values
  ('HER_EMAIL@example.com', 'Her name', 'female'),
  ('HIS_EMAIL@example.com', 'Jeff', 'male')
) as v(email, display_name, role) on true
join auth.users u on lower(u.email) = lower(v.email);

-- Check: should list both of you with the same house_id.
select p.display_name, p.role, p.house_id from public.profiles p;
