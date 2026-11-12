-- Couple Home: one house, two people, chat history. Run once in the Supabase SQL editor.

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  house_id uuid not null references public.houses,
  display_name text not null,
  role text not null check (role in ('female', 'male')),
  look jsonb not null default '{}'::jsonb
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses,
  sender uuid not null references public.profiles,
  text varchar(200) not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_house_time on public.chat_messages (house_id, created_at desc);

-- The caller's house, looked up without tripping RLS on profiles.
create or replace function public.my_house_id() returns uuid
language sql stable security definer set search_path = public as $$
  select house_id from public.profiles where id = auth.uid()
$$;

alter table public.houses enable row level security;
alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "read my house" on public.houses;
create policy "read my house" on public.houses for select to authenticated using (id = public.my_house_id());

drop policy if exists "read housemates" on public.profiles;
create policy "read housemates" on public.profiles for select to authenticated using (house_id = public.my_house_id());

drop policy if exists "update my look" on public.profiles;
create policy "update my look" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Only the look column may change from the app.
revoke update on public.profiles from authenticated;
grant update (look) on public.profiles to authenticated;

drop policy if exists "read house chat" on public.chat_messages;
create policy "read house chat" on public.chat_messages for select to authenticated using (house_id = public.my_house_id());

drop policy if exists "send house chat" on public.chat_messages;
create policy "send house chat" on public.chat_messages for insert to authenticated
  with check (sender = auth.uid() and house_id = public.my_house_id());
