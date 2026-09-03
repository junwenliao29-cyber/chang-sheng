-- ============================================================
-- 昌盛 CHANG SHENG — 自取取餐号（排队号码）数据库脚本
-- 使用方法：在 Supabase SQL Editor 粘贴本文件全部内容并 Run
-- 本脚本可重复执行
-- 说明：只有顾客点击“通过 WhatsApp 发送订单”时才 +1 取号，
--       号码由数据库原子递增，保证不重复、不乱序。
-- ============================================================

-- 计数器表（只有一行：n 表示已经发到几号）
create table if not exists public.order_counter (
  id integer primary key default 1 check (id = 1),
  n integer not null default 0
);
insert into public.order_counter (id, n) values (1, 0)
on conflict (id) do nothing;

alter table public.order_counter enable row level security;
-- 注意：不给 anon/authenticated 任何直接读写权限，
-- 取号只能通过下面的函数（每次 +1 并返回新号码）。

-- 取号函数：原子递增并返回新号码
create or replace function public.next_order_number()
returns integer
language sql
security definer
set search_path = public
as $$
  update public.order_counter set n = n + 1 where id = 1 returning n;
$$;

revoke all on function public.next_order_number() from public;
grant execute on function public.next_order_number() to anon, authenticated;
