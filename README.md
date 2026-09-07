# 昌盛 CHANG SHENG · 中餐馆网站（购物车点餐版）

智利中餐馆 **昌盛 CHANG SHENG** 的官方网站与后台：

- 🍜 **顾客网站**（`index.html`，西班牙语）：菜单 + **购物车下单**——自取(Retiro)显示总价并自动分配取餐号，配送(Despacho)填姓名/地址/定位、不显示价格；确认后自动跳 WhatsApp 发订单
- 🔐 **管理后台**（`admin.html`，中文界面）：登录后可在线上改**菜名、价格、分类、图片、上下架、店铺信息（地址/营业时间/WhatsApp/Google Maps 链接）**，顾客刷新即可看到
- 📊 后台带**访问统计**（每天/每个时段多少人浏览、下单、销售额），以及**分类/菜品拖动排序**（保留 ↑/↓ 按钮）、**图片上传（本地/拖拽）**

> 纯静态网页（HTML/CSS/JS，**无需 Node 构建**），托管在 **GitHub Pages**；数据存在免费的 **Supabase** 云数据库。无论 macOS 还是 **Windows** 都能开发和部署。

---

## 目录结构

```
├── index.html           顾客网站（西班牙语）
├── admin.html           管理后台（中文界面）
├── css/
│   ├── site.css         顾客网站样式
│   └── admin.css        管理后台样式
├── js/
│   ├── config.js        ★ Supabase 配置（地址 + 公钥）——换电脑后要确认没被还原
│   ├── supabase.js      本地化 Supabase 组件（不用联网 CDN）
│   ├── utils.js         公共小工具
│   ├── demo-data.js     演示数据（未连接数据库时自动使用）
│   ├── data.js          数据层（自动切换 演示 / Supabase）
│   ├── site.js          顾客网站逻辑
│   └── admin.js         管理后台逻辑
└── supabase/
    ├── schema.sql       建表 + 安全策略（在 Supabase SQL Editor 运行）
    ├── seed.sql         示例菜单（可选，在 Supabase SQL Editor 运行）
    ├── migration-stats.sql      统计 + 图片存储（可选）
    └── migration-ordernum.sql   取餐号（如以后恢复点餐再用）
```

---

## 在 Windows 上本地预览

推荐用 **VS Code + Live Server**（最简单）：

1. 安装 [VS Code](https://code.visualstudio.com/)
2. 在 VS Code 扩展里搜并安装 **Live Server**
3. 用 VS Code 打开本项目文件夹 → 右键 `index.html` → **Open with Live Server**
4. 浏览器会自动打开 `http://127.0.0.1:5500/`；`admin.html` 同样方式打开

也可以用命令行（二选一）：

```powershell
# 方法 A：装了 Python
python -m http.server 8000

# 方法 B：装了 Node.js
npx serve .
```

然后访问 <http://localhost:8000>（或 npx serve 提示的地址）。

> ⚠️ 别直接双击 `index.html` 用 `file://` 打开：浏览器可能因跨域限制导致连不上 Supabase、图片/数据加载异常。请用上面的本地服务器方式。

---

## 把修改发布上线（Windows 上也能做）

网站靠 Git + GitHub Pages 发布。在 Windows 上安装 [Git for Windows](https://git-scm.com/)，然后在项目文件夹打开 **Git Bash**（右键菜单里有）：

```bash
git add .
git commit -m "修改了 xxx"
git push
```

> 第一次在 Windows 上使用如果提示要登录，会弹出浏览器让你登录 GitHub 授权一次。
> 不想用命令的话，也可以装 **GitHub Desktop**：打开仓库 → 输入摘要 → Commit → Push。

推送后等约 1 分钟，GitHub Pages 自动更新：

- 顾客网站：<https://junwenliao29-cyber.github.io/chang-sheng/>
- 管理后台：<https://junwenliao29-cyber.github.io/chang-sheng/admin.html>

> 若以后换了 GitHub 账号/仓库，改一下这里两个网址即可（代码本身不用重做）。

---

## 换电脑 / 换系统后要做的 3 件事

1. **把代码从 GitHub 克隆下来**

```bash
git clone https://github.com/junwenliao29-cyber/chang-sheng.git
cd chang-sheng
```

2. **确认 `js/config.js` 已填好**（克隆下来会保留已提交的配置，通常不用动）：

```js
window.APP_CONFIG = {
  supabaseUrl: "https://你的项目.supabase.co",
  supabaseAnonKey: "你的 anon/publishable key",
};
```

3. **本地预览一遍**（见上文）→ 改东西 → `git add . && git commit -m "..." && git push`

数据库（菜单、图片、统计）都在 **Supabase 云端**，跟电脑无关，换电脑**数据不会丢**，无需重新建表。

---

## 修改 Supabase 数据库（换到新项目时才需要）

一般**不需要**再动数据库。只有当你新建了 Supabase 项目、或旧表结构缺失时才需要：

1. 打开 <https://supabase.com> → 你的项目 → 左侧 **SQL Editor**
2. 依次粘贴并 Run：
   - `supabase/schema.sql`（建表 + 安全策略）
   - 需要统计/图片时：`supabase/migration-stats.sql`
   - 需要取餐号时：`supabase/migration-ordernum.sql`
3. 左侧 **Authentication → Users → Add user** 建管理员账号（登录后台用）
4. 把项目 **Settings → API** 里的 Project URL 和 anon(publishable) key 填进 `js/config.js`

> SQL 脚本都是“可重复执行”的（用 `create ... if not exists`），重复 Run 不会报错。

---

## Windows 开发注意事项

- **编码**：所有文件都是 **UTF-8（无 BOM）**。改代码时请用 VS Code 等现代编辑器，**不要用 Windows 记事本**保存，否则中文可能变乱码。
- **换行符**：仓库已带 `.gitattributes`，会把文件统一成 LF，避免每次切系统出现大量“改了整行”的假差异。
- **命令行**：用 **Git Bash** 或 VS Code 终端执行 git/python 命令（PowerShell 也能用，但路径/命令写法略有差异）。
- **图片上传**：后台传图需要登录管理员账号；上传的图片存在 Supabase Storage，和本地文件无关。

---

## 常见问题

**Q：本地能看，但线上没更新？**
改完后要 `git push` 成功，再等约 1 分钟刷新页面（必要时 `Ctrl+F5` 强刷）。如果是后台改动，也要强刷后台页。

**Q：后台登录报错 / 空白？**
确认 `js/config.js` 已填、`supabase.js` 本地文件存在、数据库脚本已运行、并在 Supabase 建过管理员账号。

**Q：顾客下单流程？**
客人把菜加入购物车 → 选 Retiro（自取：显示总价并自动拿到取餐号）或 Despacho（配送：填姓名/地址/定位，不显示价格）→ 确认后自动跳 WhatsApp 把订单发给你，你回复确认即可。

---

© 昌盛 CHANG SHENG
