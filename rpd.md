# 昌盛 CHANG SHENG 项目交接说明（给 AI 开发用）

> 用途：本文件是给 **AI 助手** 的完整项目说明书。老板（中文沟通）在 Windows/macOS 上新建对话时，把本文件整段发给 AI，AI 即可直接接手开发，无需重新摸索。
> 更详细的部署/开发步骤见同目录 `README.md`；两者配合使用。

---

## 1. 项目是什么

智利中餐馆 **昌盛 CHANG SHENG** 的官方网站（**当前 = 购物车点餐版**：加购物车 → 自取/配送二选一 → WhatsApp 自动发单；仅自取显示价格与总价，并自动分配取餐号）：

- **顾客网站** `index.html`：西班牙语菜单（分类+菜品+价格、Agotado）；可**加入购物车**下单（Retiro 自取 / Despacho 配送），确认后自动跳 WhatsApp 发订单并**自动分配取餐号**（仅自取显示总价；配送只填姓名/地址/定位、不显示价格）。
- **管理后台** `admin.html`：中文界面，老板登录后可在线改菜名/价格/分类/图片/上下架/排序/店铺信息，顾客刷新即生效。
- 托管在 **GitHub Pages**，数据在 **Supabase** 云端（免费）。

## 2. 版本历史（重要，别搞混）

- 早期做过“购物车 + 自取/配送 + WhatsApp 自动发单 + 取餐号”功能；中途老板要求删掉改成纯菜单版。
- **2026-09 老板要求把购物车 + 自动取餐号加回来**：顾客端 `index.html` / `js/site.js` / `css/site.css` 从 `71fd2d1`（删购物车前的最后一版）恢复后微调——自取(Retiro)显示价格/总价并**后台自动取号**（`next_order_number`），配送(Despacho)不显示价格、需填姓名+地址+定位；结算抽屉可上下滚动；配色改为中国红/鎏金/宣纸米。顶部金红回纹条仍按老板要求移除。
- 数据库里的 `events`、`order_counter` 及取号函数**是顾客端在用逻辑，不要删**；后台“取餐号”面板继续保留（可查看/纠正/重置号码）。
- 历史提交都在 git 里，可查。

## 3. 技术栈（没有 Node 构建！）

- 纯静态：HTML + CSS + JavaScript（原生，无框架、无打包）。
- Supabase 组件是**本地文件** `js/supabase.js`（v2 UMD），**不要改回 CDN**（之前 CDN 加载失败导致后台登录报错）。
- 无需 Node/npm；本地预览用静态服务器即可（Live Server 或 `python -m http.server 8000`）。
- GitHub Pages 自动部署 main 分支。

## 4. 网址与仓库

- 顾客网站：https://junwenliao29-cyber.github.io/chang-sheng/
- 管理后台：https://junwenliao29-cyber.github.io/chang-sheng/admin.html
- 仓库：https://github.com/junwenliao29-cyber/chang-sheng （分支 `main`，GitHub Pages 已开）
- 若老板换了 GitHub 账号/仓库，克隆新地址并把上面两个网址改成新的即可。

## 5. 文件地图

```
index.html        顾客网站（西班牙语）
admin.html        管理后台（中文界面）
rpd.md            本文件（给 AI 的交接说明）
README.md         人类/开发说明（含 Windows 指南）
.gitattributes    统一 LF 换行，防止 Windows/macOS 差异
css/site.css      顾客网站样式
css/admin.css     管理后台样式
js/config.js      ★ Supabase 地址+公钥（读取这里的值，不要在别处写死）
js/supabase.js    本地 Supabase 组件（勿换 CDN）
js/utils.js       工具：价格格式($4.500)、wa.me 链接、消息生成等
js/demo-data.js   演示数据（Supabase 未配置时自动用）
js/data.js        数据层（演示/Supabase 自动切换）
js/site.js        顾客网站逻辑
js/admin.js       管理后台逻辑
supabase/schema.sql            建表+RLS（全新项目用）
supabase/seed.sql              示例菜单（可选）
supabase/migration-stats.sql   统计+图片存储（可重复执行）
supabase/migration-ordernum.sql 取餐号（保留备用）
```

## 6. 数据库（Supabase）

- 项目 URL 与 anon(publishable) key：见 `js/config.js`（公钥，可公开，不是 secret；**secret/service_role 永不写入代码或发给别人**）。
- 表：
  - `categories`：id, name_es, name_zh, sort_order
  - `dishes`：id, category_id(外键,级联删除), name_es, name_zh, description, price_clp(整数CLP), image_url, available, sort_order
  - `settings`：key-value；已有 key：store_name, whatsapp_number, address, map_link, hours, announcement
  - `events`：统计 type(view/order), session_id, amount_clp, created_at；RLS：可写入(anon+auth)，仅 authenticated 可读
  - `order_counter`：取餐号计数（备用）
- Storage 桶：`dish-images`（公开读；仅登录管理员传/改/删）。
- RLS 要点：顾客网站用公钥只能读菜单/写统计；后台登录（Supabase Auth）后才能改数据。
- 函数：`next_order_number`（顾客自取下单选“发送”时自动调用取号）/ `current_order_number` / `set_order_number` / `reset_order_number`（后台“取餐号”面板用）。
- 改数据库结构时：只更新 `supabase/*.sql`，并让老板去 Supabase → SQL Editor 运行（AI 没有数据库管理员权限）。

## 7. 当前功能清单

顾客网站（购物车点餐版）：
- 中式牌匾欢迎区（四角回纹 + 红印章“中华”）；配色为中国红/鎏金/宣纸米；顶部金红回纹条已移除
- 分类导航、菜品卡片（+ Agregar 加购物车、图片占位/中文大字、价格智利格式如 $4.500、Agotado 置灰）
- 右下角 **Carrito 购物车按钮常驻**（只要有可点菜品就显示，空车也显示 0，电脑/手机都有入口）；**抽屉可上下滚动**：自取显示单价/小计/总价；配送不显示价格
- **自动取餐号**：自取下单由后台 `next_order_number` 自动发号（同一单改后重发沿用同一号）；配送则填姓名+地址+“用我的当前位置”
- 下单后自动跳 WhatsApp 带订单明细（自取含金额与取餐号），购物车清空并显示感谢语
- 公告栏（settings.announcement）
- Contacto：地址/营业时间/WhatsApp/Google Maps 带路按钮（settings.map_link）
- 访问统计：view 每次打开 1 条（同浏览器每天 1 次）；order 在确认下单后记 1 条并带金额（均 keepalive）

管理后台：
- Supabase Auth 邮箱+密码登录
- 菜单管理：分类增删改、菜品增删改；**手动排序**（分类和菜品都可**拖动排序**，同时保留 ↑/↓ 按钮 + 排序数字框）；**图片上传**（点选/拖拽/网页图片网址）
- 菜品编辑弹窗内可点“＋ 新增另一道”直接连续录入；保存后按 **Esc** 或 **空格**（焦点不在输入框时）可关闭弹窗
- 编辑菜品**回车=快速保存**（备注框 Ctrl+回车=保存）；“‹ 上一个 / 下一个 ›”（或 Alt+↑/↓）按当前列表顺序快速切换；菜品管理右上角有**快速查找**框（西语/中文名实时过滤，手机端同样可用）
- 店铺设置：店名、WhatsApp 号码、地址、Google Maps 链接、营业时间、公告
- 访问统计：今日/近60天 访问、下单、销售额、时段分布（顾客确认订单后记 1 次/天/浏览器，并记录订单金额）
- 取餐号面板：查看/改成指定号/重置（保留备用）
- 使用说明标签页

## 8. 沟通与文案约定（务必遵守）

- **老板用中文提需求**，需求沟通用中文。
- **顾客网站一切文案用西班牙语**；中文只出现在中文名/装饰字里。
- 风格：中式、红金配色、**含蓄不突兀**。老板之前明确删掉了“巨大背景昌字水印”和“竖排小字”，不喜欢夸张元素；加装饰前先想是否太抢眼。
- **不要**在自动生成的 WhatsApp 消息里用 emoji/星号平面字符（之前出现过 � 乱码）；可加粗用 `*文字*`（WhatsApp 语法，安全）。
- 购物车/下单相关 id 与逻辑（cartFab/cartDrawer/custName/custAddr/locBtn/waOrderBtn 等）**已恢复并在使用**，不要当成“旧残留”删掉。
- 中文文本里 空格断行 用半角；文件一律 UTF-8 无 BOM。

## 9. 后台编辑弹窗防坑

- 编辑菜品弹窗**保存后不自动关**（防止老板以为被误关）；点 ✕/取消，或按 **Esc**（任意焦点）/ **空格**（焦点不在输入框时）都会关闭。
- **回车 = 快速保存**：在输入框里按回车即保存（备注框回车=换行，需 Ctrl/Cmd+回车保存），保存后弹窗不关，可继续改或切换。
- **“‹ 上一个 / 下一个 ›”（或 Alt+↑/↓）** 按当前列表显示顺序快速切换菜品（顺序受“分类筛选 + 快速查找”影响）；若有未保存修改，切换前会先询问是否放弃。
- “＋ 新增另一道”会清空表单进入新增模式（先保存再点，否则未保存修改会丢弃）。
- 若改动涉及 `admin.js`/`admin.css`，记得 `.hidden { display:none !important; }` 规则在 `admin.css` 里已存在，别误删。

## 10. AI 接手后的标准工作流

1. 克隆/拉取仓库：`git clone https://github.com/junwenliao29-cyber/chang-sheng.git`（已在机器上则 `git pull`）。
2. 先读 `rpd.md` + `README.md`，再看相关源码。
3. 按老板本次需求修改代码。
4. 自测：JS 改完至少跑 `node --check 文件名.js`；本地起服务器（`python -m http.server 8000` 或 Live Server）肉眼过一遍顾客站和后台。
5. 提交并推送：`git add . && git commit -m "改了什么" && git push`（GitHub Pages 约 1 分钟自动上线）。
6. 把网址发给老板，提醒强刷（`Ctrl+F5` / `Cmd+Shift+R`）验收；有 bug 继续修。
7. 每次小步改动、及时推送，不要攒一堆；老板随时要能预览。

## 11. 不要把以下内容写进代码/发给别人

- Supabase service_role / secret key、任何密码、GitHub token（这些只在老板本人操作时使用）。
- 老板的个人隐私。

## 12. 可能的后续需求（等老板开口再动）

- “点某道菜直接跳 WhatsApp 发这道菜”的快捷按钮（购物车版暂未加，等老板开口再加）。
- 自定义域名（如 changsheng.cl）让网址更短。

---

（本文档随代码一起提交到仓库；每次重要改动后建议让 AI 顺手更新本文件的“当前功能清单”。）
