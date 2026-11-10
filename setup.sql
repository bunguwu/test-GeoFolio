-- GeoFolio + Supabase. Chạy trong Supabase > SQL Editor > New query > Run.
-- Bản demo thuyết trình: toàn bộ dữ liệu app lưu trong 1 dòng JSON, ai cũng đọc/ghi được (không bảo mật).
create table if not exists app_state(id int primary key, data jsonb not null default '{}', updated_at timestamptz default now());
insert into app_state(id,data) values(1,'{}') on conflict (id) do nothing;
alter table app_state enable row level security;
drop policy if exists "demo open access" on app_state;
create policy "demo open access" on app_state for all to anon using (true) with check (true);
