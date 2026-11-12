alter table public.profiles add column if not exists avatar_path text;

grant update (look, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "upload my avatar" on storage.objects;
create policy "upload my avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "replace my avatar" on storage.objects;
create policy "replace my avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "see house avatars" on storage.objects;
create policy "see house avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.house_id = public.my_house_id()
    )
  );
