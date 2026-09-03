# 昌盛 CHANG SHENG · 中餐馆点餐网站

一个给智利中餐馆 **昌盛 CHANG SHENG** 用的单页点餐网站：

- 🍜 顾客看到**西班牙语菜单**，可按分类浏览菜品、加入**购物车**
- 💬 点“下单”后自动把订单（菜品清单 + 总价 + 顾客信息）发到老板的 **WhatsApp**
- 🔐 老板登录 **管理后台**（`admin.html`），可随时在线**修改菜名、价格、分类、图片、上下架**和店铺信息，顾客刷新即可看到

> 网站是纯静态页面（HTML/CSS/JS），可免费托管在 **GitHub Pages**；菜单数据存放在免费的 **Supabase** 云数据库里。无需服务器。

---

## 目录结构

```
├── index.html           顾客点餐网站（西班牙语，单页）
├── admin.html           管理后台（老板用，中文界面）
├── css/
│   ├── site.css         顾客网站样式
│   └── admin.css        管理后台样式
├── js/
│   ├── config.js        ★ 放 Supabase 地址和密钥的地方（需要你填写）
│   ├── utils.js         公共小工具
│   ├── demo-data.js     演示数据（未连接数据库时使用）
│   ├── data.js          数据层：自动切换演示/数据库模式
│   ├── site.js          顾客网站逻辑
│   └── admin.js         管理后台逻辑
└── supabase/
    ├── schema.sql       建表 + 安全策略（在 Supabase SQL Editor 运行）
    └── seed.sql         示例菜单数据（在 Supabase SQL Editor 运行）
```

---

## 本地预览（可选）

不需要联网，先看看效果。在项目文件夹里运行：

```bash
python3 -m http.server 8000
```

浏览器打开 <http://localhost:8000> 即可预览顾客网站；打开 <http://localhost:8000/admin.html> 查看管理后台。

> 注意：未连接 Supabase 前，网站顶部会显示“演示模式”，使用的是内置示例菜单，方便预览。连接数据库后自动消失。

---

## 上线步骤

### 第一步：把代码发布到 GitHub（免费托管网站）

1. 在 GitHub 上**新建一个仓库**（例如叫 `changsheng-restaurante`），不要勾选“添加 README”。
2. 在电脑上把代码推上去：

```bash
cd 你的项目文件夹
git init
git add .
git commit -m "昌盛 CHANG SHENG 网站"
git branch -M main
git remote add origin https://github.com/你的用户名/changsheng-restaurante.git
git push -u origin main
```

3. 在 GitHub 仓库页面打开 **Settings → Pages**：
   - Source 选择 `Deploy from a branch`
   - Branch 选择 `main`，目录选 `/ (root)`
   - 点 **Save**
4. 等 1~2 分钟后，网站地址就是：
   `https://你的用户名.github.io/changsheng-restaurante/`
   （顾客网站；`admin.html` 就是管理后台地址）

### 第二步：创建 Supabase 数据库（免费）

1. 打开 <https://supabase.com>，用邮箱免费注册并登录。
2. 点 **New project** 新建项目（**Free 免费套餐**即可），设置数据库密码并记好，选择离智利较近的区域。
3. 项目创建后，点左侧 **SQL Editor**：
   - 先打开本项目里的 `supabase/schema.sql`，全选复制粘贴到编辑器，点 **Run**
   - 再打开 `supabase/seed.sql`，同样粘贴并 **Run**
   - 成功后会看到绿色提示（建好分类、菜品、设置表并写入示例菜单）
4. 点左侧 **Authentication → Users → Add user**，用你自己的**邮箱和密码**创建管理员账号（这就是登录后台的账号）。
5. 点左侧 **Settings → API**，复制两个值：
   - **Project URL**
   - **anon public key**
6. 打开项目里的 `js/config.js`，粘贴到对应位置并保存：

```js
window.APP_CONFIG = {
  supabaseUrl: "https://你的项目.supabase.co",   // ← Project URL
  supabaseAnonKey: "eyJhbGciOi...",               // ← anon public key
};
```

7. 把修改提交并推送：

```bash
git add js/config.js
git commit -m "配置 Supabase"
git push
```

8. 刷新你的网站和 `admin.html`，用刚才创建的管理员邮箱/密码登录，就可以开始改菜单了！

---

## 管理后台怎么用

| 想做什么 | 怎么做 |
| --- | --- |
| 改菜名/价格/描述 | 菜单管理 → 菜品那行点“编辑” |
| 下架某道菜 | 编辑里取消勾选“在售”（顾客端显示 Agotado） |
| 加新菜 / 新分类 | 点“＋新增菜品 / ＋新增分类” |
| 删除菜 / 分类 | 对应行点“删除”（删分类会连带删除其下菜品） |
| 改 WhatsApp 号码 | 店铺设置里改（只需改一次，全站和下单都会更新） |
| 改店名/地址/营业时间/公告 | 店铺设置里改，点保存 |

所有修改**保存后立即生效**：顾客刷新网站就能看到最新菜单，不用重新发布代码。

---

## 常见问题

**Q：顾客下单后我怎么收到？**
顾客填好名字和地址点“发送”，会自动打开 WhatsApp 并带着写好的订单消息发到你的号码（默认 `+56 9 5466 3415`）。你在 WhatsApp 里回复确认即可。

**Q：想换 WhatsApp 号码？**
在管理后台“店铺设置”里改 WhatsApp 号码并保存，全站按钮和下单跳转会自动更新。

**Q：菜品照片怎么加？**
编辑菜品时在“图片网址”粘贴一张图片的链接（如 https://…）。留空则显示中文占位字。照片可以先传到免费图床（如 Imgur / Postimages）再粘贴链接。

**Q：演示模式的提示怎么消失？**
按上面第二步连接好 Supabase 并填写 `js/config.js` 后自动消失。

**Q：改了价格顾客看不到？**
刷新顾客网页即可。若仍看不到，多半是 `js/config.js` 没填对或还没推送部署。

---

© 昌盛 CHANG SHENG
