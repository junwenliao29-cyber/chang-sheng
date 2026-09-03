-- ============================================================
-- 昌盛 CHANG SHENG — 自取取餐号 数据库脚本 v3
-- 使用方法：在 Supabase SQL Editor 粘贴本文件全部内容并 Run（可重复执行）
-- 说明：
--   · 顾客点“通过 WhatsApp 发送订单”时自动取下一个号（原子递增，不重复）
--   · 老板可在后台查看当前号码、手动改成指定号码、或重置为 0
-- ============================================================

-- 计数器表（只有一行：n 表示已经发到几号）
create table if not exists public.order_counter (
  id integer primary key default 1 check (id = 1),
  n integer not null default 0
);
insert into public.order_counter (id, n) values (1, 0)
on conflict (id) do nothing;

alter table public.order_counter enable row level security;
-- 不给 anon/authenticated 直接读写权限，只能通过函数取号。

-- 顾客自动取号：+1 并返回新号码
create or replace function public.next_order_number()
returns integer
language sql
security definer
set search_path = public
as $$
  update public.order_counter set n = n + 1 where id = 1 returning n;
$$;

-- 后台查看当前号码
create or replace function public.current_order_number()
returns integer
language sql
security definer
set search_path = public
as $$
  select n from public.order_counter where id = 1;
$$;

-- 后台手动改成指定号码（不小于 0）
create or replace function public.set_order_number(new_num integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.order_counter set n = greatest(0, new_num) where id = 1 returning n;
$$;

-- 后台重置为 0（下一个顾客从 #1 开始）
create or replace function public.reset_order_number()
returns integer
language sql
security definer
set search_path = public
as $$
  update public.order_counter set n = 0 where id = 1 returning n;
$$;

-- 权限：顾客可用取号函数；查看/修改/重置仅登录管理员
revoke all on function public.next_order_number() from public;
grant execute on function public.next_order_number() to anon, authenticated;

revoke all on function public.current_order_number() from public;
grant execute on function public.current_order_number() to authenticated;

revoke all on function public.set_order_number(integer) from public;
grant execute on function public.set_order_number(integer) to authenticated;

revoke all on function public.reset_order_number() from public;
grant execute on function public.reset_order_number() to authenticated;
