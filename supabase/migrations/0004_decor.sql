-- Shared home decoration and spending coins in the shop.

create table if not exists public.house_items (
  uid text primary key,
  house_id uuid not null references public.houses,
  item text not null,
  x double precision not null,
  z double precision not null,
  rot double precision not null default 0,
  owner uuid not null references public.profiles,
  seq bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists house_items_house on public.house_items (house_id);

alter table public.house_items enable row level security;

drop policy if exists "read house items" on public.house_items;
create policy "read house items" on public.house_items
  for select to authenticated
  using (house_id = public.my_house_id());

drop policy if exists "place in my house" on public.house_items;
create policy "place in my house" on public.house_items
  for insert to authenticated
  with check (house_id = public.my_house_id() and owner = auth.uid());

drop policy if exists "move house items" on public.house_items;
create policy "move house items" on public.house_items
  for update to authenticated
  using (house_id = public.my_house_id());

drop policy if exists "remove house items" on public.house_items;
create policy "remove house items" on public.house_items
  for delete to authenticated
  using (house_id = public.my_house_id());

-- Pay for a shop item from my wallet; refuses if I can't afford it.
create or replace function public.spend_coins(amount integer, reason text)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $fn$
declare
  w public.wallets;
begin
  insert into public.wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if amount < 0 or w.balance < amount then
    raise exception 'not enough coins';
  end if;
  update public.wallets set balance = w.balance - amount where user_id = auth.uid() returning * into w;
  return w;
end;
$fn$;

grant execute on function public.spend_coins(integer, text) to authenticated;
