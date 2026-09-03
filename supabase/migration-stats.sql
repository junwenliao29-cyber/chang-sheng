-- ============================================================
-- 昌盛 CHANG SHENG — 新功能数据库脚本（统计 + 图片存储）
-- 使用方法：在 Supabase SQL Editor 粘贴本文件全部内容并 Run
-- 本脚本可重复执行
-- ============================================================

-- ---------- 1) 访问 / 下单统计表 ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('view', 'order')),
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_created on public.events(created_at);

alter table public.events enable row level security;

-- 顾客网站可以记录访问/下单；只有登录的管理员才能查看统计
create policy "events public insert" on public.events
  for insert to anon, authenticated with check (true);
create policy "events admin read" on public.events
  for select to authenticated using (true);

-- ---------- 2) 菜品图片存储桶（公开可看，仅登录管理员可传/删） ----------
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

create policy "dish-images public read" on storage.objects
  for select using (bucket_id = 'dish-images');
create policy "dish-images auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'dish-images');
create policy "dish-images auth update" on storage.objects
  for update to authenticated using (bucket_id = 'dish-images');
create policy "dish-images auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'dish-images');
