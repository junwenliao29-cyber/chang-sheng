-- ============================================================
-- 昌盛 CHANG SHENG — Supabase 建表脚本
-- 使用方法：在 Supabase 控制台左侧 SQL Editor 里粘贴本文件全部内容并 Run
-- ============================================================

-- 启用 gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------- 分类表 ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_es text not null,                 -- 西语名（顾客看到）
  name_zh text default '',               -- 中文名（可选）
  sort_order int default 0,              -- 排序（小的在前）
  created_at timestamptz default now()
);

-- ---------- 菜品表 ----------
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name_es text not null,                 -- 西语菜名
  name_zh text default '',               -- 中文菜名（可选）
  description text default '',           -- 西语描述（可选）
  price_clp int not null default 0 check (price_clp >= 0),  -- 价格：智利比索（整数）
  image_url text default '',             -- 图片网址（可选）
  available boolean default true,        -- 是否在售
  sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_dishes_category on public.dishes(category_id);

-- ---------- 店铺设置表（key-value） ----------
create table if not exists public.settings (
  key text primary key,
  value text default ''
);

-- ============================================================
-- 安全策略：顾客网站可以公开读取；只有登录的管理员才能增删改
-- ============================================================
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.settings enable row level security;

-- 公开读取（顾客端）
create policy "public read categories" on public.categories for select using (true);
create policy "public read dishes" on public.dishes for select using (true);
create policy "public read settings" on public.settings for select using (true);

-- 仅登录用户可写（管理后台）
create policy "auth write categories" on public.categories
  for insert to authenticated with check (true);
create policy "auth update categories" on public.categories
  for update to authenticated using (true);
create policy "auth delete categories" on public.categories
  for delete to authenticated using (true);

create policy "auth write dishes" on public.dishes
  for insert to authenticated with check (true);
create policy "auth update dishes" on public.dishes
  for update to authenticated using (true);
create policy "auth delete dishes" on public.dishes
  for delete to authenticated using (true);

create policy "auth write settings" on public.settings
  for insert to authenticated with check (true);
create policy "auth update settings" on public.settings
  for update to authenticated using (true);
create policy "auth delete settings" on public.settings
  for delete to authenticated using (true);
