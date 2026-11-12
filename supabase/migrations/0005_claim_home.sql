-- First login of the second account: join the house that has exactly one person, as the other role.
-- Sign-ups are disabled, so only accounts created in the dashboard can ever call this.
create or replace function public.claim_home()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me public.profiles;
  h uuid;
  partner_role text;
  name text;
begin
  select * into me from public.profiles where id = auth.uid();
  if found then
    return me;
  end if;

  select p.house_id, p.role into h, partner_role
  from public.profiles p
  group by p.house_id, p.role
  having (select count(*) from public.profiles q where q.house_id = p.house_id) = 1
  limit 1;

  if h is null then
    raise exception 'no home is waiting for a partner';
  end if;

  select initcap(split_part(email, '@', 1)) into name from auth.users where id = auth.uid();

  insert into public.profiles (id, house_id, display_name, role)
  values (auth.uid(), h, coalesce(name, 'Love'), case when partner_role = 'male' then 'female' else 'male' end)
  returning * into me;
  return me;
end;
$fn$;

grant execute on function public.claim_home() to authenticated;
