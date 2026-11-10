-- GeoFolio cho Supabase. Dán toàn bộ vào SQL Editor rồi bấm Run (chạy một lần).

-- 0. Dọn bản cũ (chạy lại an toàn). CẢNH BÁO: xóa dữ liệu của các bảng GeoFolio nếu đã có.
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.submissions, public.tasks, public.class_members, public.classes,
  public.portfolio_items, public.field_stops, public.projects, public.community_items, public.profiles cascade;
drop function if exists public.handle_new_user(), public.join_class(text),
  public.is_teacher_of_class(uuid), public.is_member_of_class(uuid), public.teaches_student(uuid);

-- 1. Bảng ---------------------------------------------------------------
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('teacher','student')),
  created_at timestamptz default now());

create table public.classes(
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  code text unique not null default upper(substr(md5(random()::text),1,6)),
  created_at timestamptz default now());

create table public.class_members(
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key(class_id, student_id));

create table public.portfolio_items(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null, type text, description text,
  created_at timestamptz default now());

create table public.field_stops(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null, category text, lat double precision, lng double precision, note text,
  created_at timestamptz default now());

create table public.projects(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null, description text, due date,
  progress int not null default 0 check (progress between 0 and 100));

create table public.tasks(
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  type text, title text not null, due date,
  created_at timestamptz default now());

create table public.submissions(
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note text,
  rubric int[] check (rubric is null or array_length(rubric,1)=4),
  score numeric(3,1), feedback text,
  graded_by uuid references public.profiles(id), graded_at timestamptz,
  created_at timestamptz default now(),
  unique(task_id, student_id));

create table public.community_items(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  author text, title text not null, place text, description text,
  created_at timestamptz default now());

-- 2. Hàm trợ giúp (security definer để tránh vòng lặp RLS) -------------------
create function public.is_teacher_of_class(c uuid) returns boolean
language sql security definer stable set search_path=public as
$$ select exists(select 1 from classes where id=c and teacher_id=auth.uid()) $$;

create function public.is_member_of_class(c uuid) returns boolean
language sql security definer stable set search_path=public as
$$ select exists(select 1 from class_members where class_id=c and student_id=auth.uid()) $$;

create function public.teaches_student(s uuid) returns boolean
language sql security definer stable set search_path=public as
$$ select exists(select 1 from class_members m join classes c on c.id=m.class_id
                 where m.student_id=s and c.teacher_id=auth.uid()) $$;

-- Học sinh nhập mã lớp: chỉ gọi qua hàm này, không cho đọc danh sách lớp
create function public.join_class(p_code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  select id into cid from classes where code = upper(trim(p_code));
  if cid is null then raise exception 'Không tìm thấy mã lớp'; end if;
  insert into class_members(class_id, student_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

-- Tự tạo hồ sơ khi có tài khoản mới (tên, vai trò lấy từ options.data lúc signUp)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, name, role) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Khách'),
    case when new.raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Bật RLS ---------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.classes         enable row level security;
alter table public.class_members   enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.field_stops     enable row level security;
alter table public.projects        enable row level security;
alter table public.tasks           enable row level security;
alter table public.submissions     enable row level security;
alter table public.community_items enable row level security;

-- 4. Chính sách ------------------------------------------------------------
-- profiles: xem hồ sơ của mình và của học sinh trong lớp mình dạy
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.teaches_student(id));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- classes: giáo viên quản lý lớp của mình, học sinh chỉ xem lớp đã tham gia
create policy "classes_teacher_all" on public.classes for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "classes_member_select" on public.classes for select to authenticated
  using (public.is_member_of_class(id));

-- class_members: xem của mình hoặc lớp mình dạy (thêm qua join_class)
create policy "members_select" on public.class_members for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of_class(class_id));

-- portfolio_items, field_stops, projects: chủ sở hữu toàn quyền, giáo viên chỉ xem
create policy "items_owner" on public.portfolio_items for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "items_teacher_read" on public.portfolio_items for select to authenticated
  using (public.teaches_student(student_id));
create policy "stops_owner" on public.field_stops for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "stops_teacher_read" on public.field_stops for select to authenticated
  using (public.teaches_student(student_id));
create policy "projects_owner" on public.projects for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "projects_teacher_read" on public.projects for select to authenticated
  using (public.teaches_student(student_id));

-- tasks: giáo viên quản lý, học sinh trong lớp được xem
create policy "tasks_teacher_all" on public.tasks for all to authenticated
  using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
create policy "tasks_member_select" on public.tasks for select to authenticated
  using (public.is_member_of_class(class_id));

-- submissions: học sinh nộp và xem bài mình (không tự ghi điểm), giáo viên xem và chấm
create policy "subs_student_select" on public.submissions for select to authenticated
  using (student_id = auth.uid());
create policy "subs_student_insert" on public.submissions for insert to authenticated
  with check (student_id = auth.uid() and score is null and rubric is null and graded_by is null
              and exists (select 1 from public.tasks t where t.id = task_id and public.is_member_of_class(t.class_id)));
create policy "subs_teacher_select" on public.submissions for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_teacher_of_class(t.class_id)));
create policy "subs_teacher_grade" on public.submissions for update to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_teacher_of_class(t.class_id)));

-- community_items: ai cũng xem được, chỉ chủ sở hữu (kể cả khách đăng nhập ẩn danh) gửi/sửa/xóa
create policy "community_read" on public.community_items for select to anon, authenticated using (true);
create policy "community_insert" on public.community_items for insert to authenticated with check (owner_id = auth.uid());
create policy "community_update" on public.community_items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "community_delete" on public.community_items for delete to authenticated using (owner_id = auth.uid());
