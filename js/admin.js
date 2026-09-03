/* ================= 昌盛 CHANG SHENG — 管理后台逻辑 ================= */
(function () {
  "use strict";

  const U = window.Utils;
  const $ = (sel) => document.querySelector(sel);
  const cfg = window.APP_CONFIG || {};
  const cfgEmpty = !(cfg.supabaseUrl && cfg.supabaseAnonKey);

  let client = null;
  let auth = null;
  let cats = [];
  let dishes = [];
  let settingsMap = {};

  let editingDishId = null; // 正在编辑的菜品 id（null = 新增）
  let toastTimer = null;

  /* ---------------- 提示消息 ---------------- */
  function toast(msg, type) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + (type || "ok");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast"; }, 2600);
  }
  function errMsg(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    // 常见 Supabase 错误翻译
    if (/Invalid login credentials/i.test(m)) return "邮箱或密码错误，请重试。";
    if (/Email not confirmed/i.test(m)) return "邮箱尚未验证，请到邮箱里点击确认链接。";
    if (/rate limit/i.test(m)) return "操作太频繁，请稍等几秒再试。";
    if (/network|fetch|load/i.test(m)) return "网络连接失败，请检查网络后重试。";
    return m;
  }

  /* ---------------- 图片上传（本地 / 拖拽 / 网址） ---------------- */
  let dishUploading = false;
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function slugName(name) {
    return String(name || "img").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-50);
  }
  function showPreview(url) {
    const img = $("#dishImgPreview");
    if (!img) return;
    if (!url || !/^https?:\/\//i.test(String(url))) { img.classList.add("hidden"); img.removeAttribute("src"); return; }
    img.src = url;
    img.classList.remove("hidden");
  }
  function setImgStatus(t) { const el = $("#dishImgStatus"); if (el) el.textContent = t || ""; }
  function setDishImageValue(url) {
    const input = $("#dishImage");
    input.value = url;
    showPreview(url);
  }
  async function uploadDishImage(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type)) { toast("请选择图片文件（jpg/png 等）", "err"); return; }
    if (!client) { toast("尚未连接数据库", "err"); return; }
    if (dishUploading) return;
    dishUploading = true;
    setImgStatus("正在上传 " + file.name + " …");
    const path = "dishes/" + Date.now() + "-" + slugName(file.name);
    try {
      const { error } = await client.storage.from("dish-images").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) {
        if (/bucket|does not exist|not found/i.test(error.message)) {
          toast("图片存储还没开启：请在 Supabase SQL Editor 运行 migration-stats.sql", "err");
          setImgStatus("上传失败：还没运行图片存储的 SQL");
        } else {
          toast("上传失败：" + errMsg(error), "err");
          setImgStatus("上传失败，请重试");
        }
        return;
      }
      const url = client.storage.from("dish-images").getPublicUrl(path).data.publicUrl;
      setDishImageValue(url);
      setImgStatus("✅ 上传成功，已自动填入（保存菜品后生效）");
    } catch (e) {
      toast("上传出错：" + errMsg(e), "err");
      setImgStatus("");
    } finally {
      dishUploading = false;
    }
  }

  /* ---------------- 访问统计 ---------------- */
  async function loadStats() {
    if (!client) return;
    const loading = $("#statsLoading");
    const errEl = $("#statsError");
    if (loading) loading.style.display = "";
    if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
    try {
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await client
        .from("events")
        .select("type, created_at")
        .gte("created_at", since)
        .limit(10000)
        .order("created_at", { ascending: true });
      if (error) throw error;
      renderStats(data || []);
    } catch (e) {
      const msg = errMsg(e);
      const friendly = /events|relation|does not exist|not exist|underlying/i.test(msg)
        ? "统计功能还没开启：请在 Supabase SQL Editor 里运行 supabase/migration-stats.sql 那段 SQL，然后点“刷新”。"
        : "加载统计失败：" + msg;
      if (errEl) { errEl.textContent = friendly; errEl.classList.remove("hidden"); }
      const clear = (id) => { const el = $(id); if (el) el.innerHTML = ""; };
      clear("#statsSummary"); clear("#statsDaysWrap"); clear("#statsHoursWrap");
    } finally {
      if (loading) loading.style.display = "none";
    }
  }
  function renderStats(rows) {
    const now = new Date();
    const today = dayKey(now);
    const days = {};
    const hours = new Array(24).fill(0);
    let views = 0, orders = 0;
    rows.forEach(function (r) {
      if (!r || !r.type) return;
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      const k = dayKey(d);
      if (!days[k]) days[k] = { views: 0, orders: 0 };
      if (r.type === "order") { days[k].orders += 1; orders += 1; }
      else { days[k].views += 1; views += 1; hours[d.getHours()] += 1; }
    });
    const tv = days[today] ? days[today].views : 0;
    const to = days[today] ? days[today].orders : 0;
    const rate = views > 0 ? (orders / views * 100) : 0;

    const cards = [
      { n: tv, l: "今日访问（人）" },
      { n: to, l: "今日下单（次）" },
      { n: views, l: "近 60 天访问（人）" },
      { n: orders, l: "近 60 天下单（次）" },
      { n: rate.toFixed(1) + "%", l: "下单率（订单 ÷ 访问）", gold: true },
    ];
    $("#statsSummary").innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="num' + (c.gold ? " gold" : "") + '">' + c.n + "</div>" +
        '<div class="lbl">' + c.l + "</div></div>";
    }).join("");

    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      last14.push(dayKey(d));
    }
    const maxDay = Math.max(1, ...last14.map((k) => (days[k] ? days[k].views : 0)));
    $("#statsDaysWrap").innerHTML =
      '<table class="stat-days"><thead><tr><th>日期</th><th>访问</th><th class="bar-cell"></th><th>下单</th></tr></thead><tbody>' +
      last14.map(function (k) {
        const v = days[k] ? days[k].views : 0;
        const o = days[k] ? days[k].orders : 0;
        const w = Math.max(1.5, Math.round(v / maxDay * 100));
        return "<tr><td>" + k + (k === today ? "（今天）" : "") + "</td><td><b>" + v + "</b></td>" +
          '<td class="bar-cell"><div class="bar"><i style="width:' + w + '%"></i></div></td><td>' + o + "</td></tr>";
      }).join("") + "</tbody></table>";

    const maxH = Math.max(1, ...hours);
    $("#statsHoursWrap").innerHTML =
      '<div class="hour-grid">' +
      hours.map(function (c, h) {
        const pct = Math.max(2, Math.round(c / maxH * 100));
        const hot = c > 0 && c === maxH ? " hot" : "";
        return '<div class="hour-cell"><div class="hour-col' + hot + '"><i style="height:' + pct + '%"></i>' +
          '<span class="cnt">' + c + '</span></div><div class="h">' + h + "时</div></div>";
      }).join("") + "</div>";
  }

  /* ---------------- 视图切换 ---------------- */
  function showSetup() {
    $("#setupPanel").classList.remove("hidden");
    $("#authPanel").classList.add("hidden");
    $("#mainPanel").classList.add("hidden");
    $("#userBox").style.display = "none";
  }
  function showAuth(msg) {
    $("#setupPanel").classList.add("hidden");
    $("#authPanel").classList.remove("hidden");
    $("#mainPanel").classList.add("hidden");
    $("#userBox").style.display = "none";
    if (msg) $("#authErr").textContent = msg;
  }
  function showMain(email) {
    $("#setupPanel").classList.add("hidden");
    $("#authPanel").classList.add("hidden");
    $("#mainPanel").classList.remove("hidden");
    $("#userBox").style.display = "flex";
    $("#userEmail").textContent = email || "";
  }

  /* ---------------- 数据读取 ---------------- */
  async function loadAll() {
    const [catRes, dishRes, setRes] = await Promise.all([
      client.from("categories").select("*").order("sort_order", { ascending: true }).order("name_es"),
      client.from("dishes").select("*").order("sort_order", { ascending: true }).order("name_es"),
      client.from("settings").select("*"),
    ]);
    if (catRes.error) throw catRes.error;
    if (dishRes.error) throw dishRes.error;
    if (setRes.error) throw setRes.error;
    cats = catRes.data || [];
    dishes = dishRes.data || [];
    settingsMap = {};
    (setRes.data || []).forEach((r) => { settingsMap[r.key] = r.value; });
  }

  async function refresh() {
    try {
      await loadAll();
      renderCats();
      renderDishFilter();
      renderDishes();
      renderSettingsForm();
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }

  /* ---------------- 分类 ---------------- */
  function catRowHTML(c) {
    const id = c ? U.escapeHTML(c.id) : "";
    return (
      '<tr data-cat-id="' + id + '">' +
      '<td><input class="cat-es" type="text" value="' + (c ? U.escapeHTML(c.name_es) : "") + '" placeholder="Ej: Entradas" /></td>' +
      '<td><input class="cat-zh" type="text" value="' + (c ? U.escapeHTML(c.name_zh || "") : "") + '" placeholder="可选" /></td>' +
      '<td><input class="cat-sort num" type="number" value="' + (c ? U.escapeHTML(String(c.sort_order || 0)) : cats.length + 1) + '" /></td>' +
      '<td><div class="row-actions">' +
      '<button class="btn btn-sm btn-primary save-cat">保存</button>' +
      (c ? '<button class="btn btn-sm btn-danger del-cat">删除</button>' : '<button class="btn btn-sm btn-ghost cancel-cat">取消</button>') +
      "</div></td></tr>"
    );
  }
  function renderCats() {
    const rows = cats.map(catRowHTML).join("");
    $("#catRows").innerHTML = rows + (cats.length ? "" : "");
  }
  async function saveCat(row) {
    const id = row.getAttribute("data-cat-id");
    const es = row.querySelector(".cat-es").value.trim();
    const zh = row.querySelector(".cat-zh").value.trim();
    const sort = U.toInt(row.querySelector(".cat-sort").value);
    if (!es) { toast("请填写分类的西语名", "err"); return; }
    try {
      if (id) {
        await client.from("categories").update({ name_es: es, name_zh: zh, sort_order: sort }).eq("id", id);
      } else {
        await client.from("categories").insert({ name_es: es, name_zh: zh, sort_order: sort });
      }
      toast("分类已保存 ✅");
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }
  async function deleteCat(row) {
    const id = row.getAttribute("data-cat-id");
    const name = row.querySelector(".cat-es").value.trim() || "该分类";
    if (!confirm("确定删除分类“" + name + "”？\n其下所有菜品也会一并删除！")) return;
    try {
      await client.from("categories").delete().eq("id", id);
      toast("分类已删除");
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }
  function catName(id) {
    const c = cats.find((x) => x.id === id);
    return c ? c.name_es : "—";
  }

  /* ---------------- 菜品 ---------------- */
  function renderDishFilter() {
    const sel = $("#dishFilter");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">全部分类</option>' +
      cats.map((c) => '<option value="' + U.escapeHTML(c.id) + '">' + U.escapeHTML(c.name_es) + "</option>").join("");
    sel.value = cats.some((c) => c.id === current) ? current : "";
  }
  function renderDishes() {
    const filter = $("#dishFilter").value;
    const list = filter ? dishes.filter((d) => d.category_id === filter) : dishes;
    const tbody = $("#dishRows");
    if (!list.length) {
      tbody.innerHTML = "";
      $("#dishEmpty").style.display = "block";
      return;
    }
    $("#dishEmpty").style.display = "none";
    tbody.innerHTML = list
      .map((d) => {
        const on = d.available !== false;
        return (
          '<tr data-dish-id="' + U.escapeHTML(d.id) + '">' +
          "<td><b>" + U.escapeHTML(d.name_es) + "</b></td>" +
          "<td>" + U.escapeHTML(d.name_zh || "") + "</td>" +
          "<td>" + U.escapeHTML(catName(d.category_id)) + "</td>" +
          '<td class="price-inline">' + U.escapeHTML(U.formatCLP(d.price_clp)) + "</td>" +
          '<td style="text-align:center;">' +
          (on ? '<span class="badge badge-on">在售</span>' : '<span class="badge badge-off">已下架</span>') +
          "</td>" +
          "<td>" + U.escapeHTML(String(d.sort_order || 0)) + "</td>" +
          '<td><div class="row-actions">' +
          '<button class="btn btn-sm btn-ghost edit-dish">编辑</button>' +
          '<button class="btn btn-sm btn-danger del-dish">删除</button>' +
          "</div></td></tr>"
        );
      })
      .join("");
  }

  /* ---------------- 菜品弹窗 ---------------- */
  function openDishModal(dish) {
    editingDishId = dish ? dish.id : null;
    $("#dishModalTitle").textContent = dish ? "编辑菜品" : "新增菜品";
    // 分类下拉
    const catSel = $("#dishCategory");
    catSel.innerHTML = cats
      .map((c) => '<option value="' + U.escapeHTML(c.id) + '">' + U.escapeHTML(c.name_es) + "</option>")
      .join("");
    const preferred = dish ? dish.category_id : $("#dishFilter").value || (cats[0] && cats[0].id) || "";
    catSel.value = cats.some((c) => c.id === preferred) ? preferred : (cats[0] && cats[0].id) || "";

    $("#dishNameEs").value = dish ? dish.name_es : "";
    $("#dishNameZh").value = dish ? dish.name_zh || "" : "";
    $("#dishPrice").value = dish ? dish.price_clp : "";
    $("#dishSort").value = dish ? dish.sort_order || 0 : cats.length ? 1 : 0;
    $("#dishDesc").value = dish ? dish.description || "" : "";
    $("#dishImage").value = dish ? dish.image_url || "" : "";
    showPreview($("#dishImage").value);
    setImgStatus("");
    $("#dishAvailable").checked = dish ? dish.available !== false : true;

    $("#dishModal").classList.add("show");
    setTimeout(() => $("#dishNameEs").focus(), 50);
  }
  function closeDishModal() {
    $("#dishModal").classList.remove("show");
    editingDishId = null;
    showPreview("");
    setImgStatus("");
  }
  async function saveDish() {
    const category_id = $("#dishCategory").value;
    const name_es = $("#dishNameEs").value.trim();
    const name_zh = $("#dishNameZh").value.trim();
    const price_clp = U.toInt($("#dishPrice").value);
    const sort_order = U.toInt($("#dishSort").value);
    const description = $("#dishDesc").value.trim();
    const image_url = $("#dishImage").value.trim();
    const available = $("#dishAvailable").checked;

    if (!category_id) { toast("请先创建一个分类", "err"); return; }
    if (!name_es) { toast("请填写西语菜名", "err"); return; }
    if (price_clp < 0) { toast("价格不能为负数", "err"); return; }

    const payload = {
      category_id: category_id,
      name_es: name_es,
      name_zh: name_zh,
      price_clp: price_clp,
      sort_order: sort_order,
      description: description,
      image_url: image_url,
      available: available,
    };
    try {
      if (editingDishId) {
        await client.from("dishes").update(payload).eq("id", editingDishId);
        toast("菜品已保存 ✅");
      } else {
        await client.from("dishes").insert(payload);
        toast("菜品已添加 ✅");
      }
      closeDishModal();
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }
  async function deleteDish(id) {
    const d = dishes.find((x) => x.id === id);
    if (!confirm("确定删除菜品“" + (d ? d.name_es : "") + "”？")) return;
    try {
      await client.from("dishes").delete().eq("id", id);
      toast("菜品已删除");
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }

  /* ---------------- 店铺设置 ---------------- */
  function renderSettingsForm() {
    $("#set_store_name").value = settingsMap.store_name || "";
    $("#set_whatsapp").value = settingsMap.whatsapp_number || "";
    $("#set_address").value = settingsMap.address || "";
    $("#set_hours").value = settingsMap.hours || "";
    $("#set_announcement").value = settingsMap.announcement || "";
  }
  async function saveSettings(e) {
    e.preventDefault();
    const entries = [
      ["store_name", $("#set_store_name").value.trim()],
      ["whatsapp_number", $("#set_whatsapp").value.trim()],
      ["address", $("#set_address").value.trim()],
      ["hours", $("#set_hours").value.trim()],
      ["announcement", $("#set_announcement").value.trim()],
    ];
    try {
      await Promise.all(
        entries.map(([key, value]) =>
          client.from("settings").upsert({ key: key, value: value }, { onConflict: "key" })
        )
      );
      toast("店铺设置已保存 ✅");
      await refresh();
    } catch (err) { toast(errMsg(err), "err"); }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    // 登录
    $("#loginBtn").addEventListener("click", async () => {
      if (!auth) {
        $("#authErr").textContent = "页面组件还没加载好，请刷新页面后再登录。";
        return;
      }
      const email = $("#loginEmail").value.trim();
      const pass = $("#loginPass").value;
      if (!email || !pass) { $("#authErr").textContent = "请输入邮箱和密码。"; return; }
      $("#authErr").textContent = "";
      $("#loginBtn").disabled = true;
      try {
        const { error } = await auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } catch (e) {
        $("#authErr").textContent = errMsg(e);
      } finally {
        $("#loginBtn").disabled = false;
      }
    });
    $("#loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
    $("#logoutBtn").addEventListener("click", async () => { await auth.signOut(); });

    // 标签切换
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
        document.querySelectorAll(".tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.getAttribute("data-panel") !== t.getAttribute("data-tab"));
        });
        if (t.getAttribute("data-tab") === "stats") loadStats();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    // 分类行操作（委托）
    $("#catRows").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const row = btn.closest("tr");
      if (btn.classList.contains("save-cat")) saveCat(row);
      else if (btn.classList.contains("del-cat")) deleteCat(row);
      else if (btn.classList.contains("cancel-cat")) renderCats();
    });

    // 新增分类
    $("#addCatBtn").addEventListener("click", () => {
      // 若已有一行“新分类”输入中则不再加
      const existingNew = document.querySelector('#catRows tr[data-cat-id=""]');
      if (existingNew) { existingNew.querySelector(".cat-es").focus(); return; }
      $("#catRows").insertAdjacentHTML("beforeend", catRowHTML(null));
      const tr = $("#catRows tr:last-child");
      tr.querySelector(".cat-es").focus();
    });

    // 菜品筛选
    $("#dishFilter").addEventListener("change", renderDishes);

    // 菜品行操作（委托）
    $("#dishRows").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.closest("tr").getAttribute("data-dish-id");
      if (btn.classList.contains("edit-dish")) {
        const d = dishes.find((x) => x.id === id);
        if (d) openDishModal(d);
      } else if (btn.classList.contains("del-dish")) {
        deleteDish(id);
      }
    });

    // 新增菜品
    $("#addDishBtn").addEventListener("click", () => {
      if (!cats.length) { toast("请先新增一个分类", "err"); return; }
      openDishModal(null);
    });

    // 弹窗
    $("#dishModalClose").addEventListener("click", closeDishModal);
    $("#dishModalCancel").addEventListener("click", closeDishModal);
    $("#dishModalSave").addEventListener("click", saveDish);
    $("#dishForm").addEventListener("submit", (e) => { e.preventDefault(); });

    // 图片上传：点击选择 / 拖拽 / 网址预览
    $("#dishImgDrop").addEventListener("click", () => $("#dishImgFile").click());
    $("#dishImgFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) uploadDishImage(f);
      e.target.value = "";
    });
    ["dragenter", "dragover"].forEach((ev) =>
      $("#dishImgDrop").addEventListener(ev, (e) => {
        e.preventDefault();
        $("#dishImgDrop").classList.add("dragover");
      })
    );
    $("#dishImgDrop").addEventListener("dragleave", (e) => { e.preventDefault(); $("#dishImgDrop").classList.remove("dragover"); });
    $("#dishImgDrop").addEventListener("drop", (e) => {
      e.preventDefault();
      $("#dishImgDrop").classList.remove("dragover");
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) { uploadDishImage(dt.files[0]); return; }
      const uri = dt ? (dt.getData("text/uri-list") || dt.getData("text/plain") || "") : "";
      if (/^https?:\/\//i.test(uri.trim())) {
        setDishImageValue(uri.trim());
        setImgStatus("已使用网页图片网址");
      }
    });
    $("#dishImage").addEventListener("input", (e) => showPreview(e.target.value.trim()));

    // 统计刷新
    $("#statsRefreshBtn").addEventListener("click", loadStats);

    // 设置保存
    $("#settingsForm").addEventListener("submit", saveSettings);
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    // 1) 未填写 config.js → 显示配置说明
    if (cfgEmpty) {
      showSetup();
      return;
    }
    // 2) 已填写但 SDK 没加载出来（离线/CDN 被拦截）
    if (!window.supabase) {
      showAuth("无法加载 Supabase 组件，请检查网络连接后刷新页面。");
      return;
    }
    client = window.Data.getClient();
    if (!client) {
      showAuth("Supabase 初始化失败，请检查 config.js 里的地址和密钥是否正确。");
      return;
    }
    auth = client.auth;

    // 监听登录状态
    auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        showMain(session.user.email);
        refresh();
      } else if (event === "SIGNED_OUT") {
        showAuth();
      }
    });

    // 恢复已有会话
    try {
      const { data } = await auth.getSession();
      if (data && data.session) {
        showMain(data.session.user.email);
        refresh();
      } else {
        showAuth();
      }
    } catch (e) {
      showAuth(errMsg(e));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    boot();
  });
})();
