-- ============================================================
-- 昌盛 CHANG SHENG — 示例菜单数据（可全部在管理后台修改）
-- 使用方法：先运行 schema.sql，再运行本文件
-- 本脚本可重复执行（不会重复插入）
-- ============================================================

-- ---------- 店铺设置 ----------
insert into public.settings (key, value) values
  ('store_name',      '昌盛 CHANG SHENG'),
  ('whatsapp_number', '56954663415'),
  ('address',         'Dirección del local — pendiente de configurar'),
  ('map_link',        ''),
  ('hours',           '12:00 – 22:00'),
  ('announcement',    '')
on conflict (key) do nothing;

-- ---------- 分类 ----------
insert into public.categories (id, name_es, name_zh, sort_order) values
  ('10000000-0000-4000-8000-000000000001', 'Entradas',              '前菜',    1),
  ('10000000-0000-4000-8000-000000000002', 'Sopas',                 '汤类',    2),
  ('10000000-0000-4000-8000-000000000003', 'Arroz y Tallarines',    '炒饭·炒面', 3),
  ('10000000-0000-4000-8000-000000000004', 'Pollo',                 '鸡肉',    4),
  ('10000000-0000-4000-8000-000000000005', 'Cerdo y Res',           '猪·牛',   5),
  ('10000000-0000-4000-8000-000000000006', 'Camarones y Mariscos',  '虾·海鲜',  6)
on conflict (id) do nothing;

-- ---------- 菜品 ----------
insert into public.dishes
  (id, category_id, name_es, name_zh, description, price_clp, image_url, available, sort_order)
values
  -- Entradas 前菜
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Wantán Frito (6 un.)', '炸云吞', 'Crujientes wantanes rellenos de cerdo, con salsa agridulce.', 4500, '', true, 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Rollo de Primavera (2 un.)', '春卷', 'Rollo crujiente de verduras y cerdo.', 3800, '', true, 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Jiaozi / Empanaditas Chinas (6 un.)', '饺子', 'Empanaditas chinas rellenas de cerdo y verduras, al vapor o fritas.', 5200, '', true, 3),

  -- Sopas 汤类
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'Sopa Wantán', '云吞汤', 'Sopa clara con wantanes de cerdo y verduras.', 5500, '', true, 1),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'Sopa de Pollo y Maíz', '玉米鸡汤', 'Sopa suave con pollo desmenuzado, maíz y huevo.', 5800, '', true, 2),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 'Sopa Agripicante', '酸辣汤', 'Sopa espesa con un toque agrio y picante, tofu y champiñones.', 5500, '', true, 3),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 'Sopa de Tallarines con Pollo', '鸡汤面', 'Fideos con pollo en un caldo aromático.', 5900, '', true, 4),

  -- Arroz y Tallarines 炒饭·炒面
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000003', 'Arroz Chaufa', '炒饭', 'Arroz salteado con pollo, cerdo, huevo y verduras.', 5500, '', true, 1),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000003', 'Arroz Chaufa Especial', '特色炒饭', 'Arroz salteado con camarones, pollo, cerdo, huevo y verduras.', 6800, '', true, 2),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000003', 'Tallarín Saltado', '炒面', 'Tallarines salteados con verduras, pollo y cerdo.', 6500, '', true, 3),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000003', 'Tallarín Saltado Especial', '特色炒面', 'Tallarines salteados con camarones y carnes.', 7500, '', true, 4),

  -- Pollo 鸡肉
  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000004', 'Pollo Kung Pao', '宫保鸡丁', 'Pollo salteado con maní, ají y salsa agripicante.', 7500, '', true, 1),
  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000004', 'Pollo con Verduras', '时蔬炒鸡', 'Pollo salteado con verduras frescas.', 7200, '', true, 2),
  ('20000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000004', 'Pollo Agridulce', '糖醋鸡', 'Pollo crocante con salsa agridulce.', 7200, '', true, 3),
  ('20000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000004', 'Pollo con Champiñones', '蘑菇炒鸡', 'Pollo salteado con champiñones y cebollín.', 7200, '', true, 4),

  -- Cerdo y Res 猪·牛
  ('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000005', 'Cerdo Agridulce', '糖醋里脊', 'Cerdo crocante con salsa agridulce y verduras.', 7800, '', true, 1),
  ('20000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000005', 'Res con Brócoli', '西兰花牛肉', 'Trozos de res salteados con brócoli.', 8500, '', true, 2),
  ('20000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000005', 'Cerdo con Verduras', '时蔬炒肉', 'Cerdo salteado con verduras frescas.', 7800, '', true, 3),
  ('20000000-0000-4000-8000-000000000044', '10000000-0000-4000-8000-000000000005', 'Res con Salsa de Ostiones', '蚝油牛肉', 'Res salteada con salsa de ostiones y cebolla.', 8800, '', true, 4),

  -- Camarones y Mariscos 虾·海鲜
  ('20000000-0000-4000-8000-000000000051', '10000000-0000-4000-8000-000000000006', 'Camarones con Verduras', '时蔬炒虾', 'Camarones salteados con verduras frescas.', 9500, '', true, 1),
  ('20000000-0000-4000-8000-000000000052', '10000000-0000-4000-8000-000000000006', 'Camarones Agridulces', '糖醋虾', 'Camarones crocantes con salsa agridulce.', 9500, '', true, 2),
  ('20000000-0000-4000-8000-000000000053', '10000000-0000-4000-8000-000000000006', 'Arroz Chaufa con Camarones', '虾仁炒饭', 'Arroz salteado con camarones, huevo y verduras.', 7500, '', true, 3),
  ('20000000-0000-4000-8000-000000000054', '10000000-0000-4000-8000-000000000006', 'Salteado de Mariscos', '海鲜炒', 'Mix de mariscos salteados con verduras frescas.', 10500, '', true, 4)
on conflict (id) do nothing;
