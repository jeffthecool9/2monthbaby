create table if not exists public.wallets (
  user_id uuid primary key references public.profiles on delete cascade,
  balance integer not null default 0,
  day date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  earned_today integer not null default 0
);

alter table public.wallets enable row level security;

drop policy if exists "read my wallet" on public.wallets;
create policy "read my wallet" on public.wallets
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.award_coins(amount integer, reason text)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $fn$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  w public.wallets;
  granted integer;
begin
  insert into public.wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if w.day <> today then
    w.day := today;
    w.earned_today := 0;
  end if;
  granted := greatest(0, least(amount, 60, 1000 - w.earned_today));
  update public.wallets
    set balance = w.balance + granted, earned_today = w.earned_today + granted, day = w.day
    where user_id = auth.uid()
    returning * into w;
  return w;
end;
$fn$;

grant execute on function public.award_coins(integer, text) to authenticated;
