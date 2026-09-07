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
  let editingSnapshot = null; // 打开弹窗时该菜品的原始值，用于“未保存”提醒
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
        .select("type, created_at, amount_clp")
        .gte("created_at", since)
        .limit(10000)
        .order("created_at", { ascending: true });
      if (error) throw error;
      renderStats(data || []);
    } catch (e) {
      const msg = errMsg(e);
      let friendly;
      if (/amount_clp|column.*does not exist|does not exist.*column/i.test(msg)) {
        friendly = "统计表还缺“金额”字段：请在 Supabase SQL Editor 运行最新统计 SQL（给 events 表加 amount_clp）后点刷新。";
      } else if (/events|relation|does not exist|not exist|underlying/i.test(msg)) {
        friendly = "统计功能还没开启：请在 Supabase SQL Editor 里运行 supabase/migration-stats.sql 那段 SQL，然后点“刷新”。";
      } else {
        friendly = "加载统计失败：" + msg;
      }
      if (errEl) { errEl.textContent = friendly; errEl.classList.remove("hidden"); }
      const clear = (id) => { const el = $(id); if (el) el.innerHTML = ""; };
      clear("#statsSummary"); clear("#statsDaysWrap"); clear("#statsHoursWrap");
    } finally {
      if (loading) loading.style.display = "none";
    }
  }
  function renderStats(rows) {
    function money(n) { return U.formatCLP(n); }
    const now = new Date();
    const today = dayKey(now);
    const days = {};
    const hours = new Array(24).fill(0);
    let views = 0, orders = 0, sales = 0;
    rows.forEach(function (r) {
      if (!r || !r.type) return;
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      const k = dayKey(d);
      if (!days[k]) days[k] = { views: 0, orders: 0, amount: 0 };
      if (r.type === "order") {
        const amt = Number(r.amount_clp) || 0;
        days[k].orders += 1; days[k].amount += amt;
        orders += 1; sales += amt;
      } else {
        days[k].views += 1; views += 1; hours[d.getHours()] += 1;
      }
    });
    const td = days[today] || { views: 0, orders: 0, amount: 0 };
    const rate = views > 0 ? (orders / views * 100) : 0;

    const cards = [
      { n: td.views, l: "今日访问（人）" },
      { n: td.orders, l: "今日下单（次）" },
      { n: money(td.amount), l: "今日销售额", gold: true },
      { n: views, l: "近 60 天访问（人）" },
      { n: orders, l: "近 60 天下单（次）" },
      { n: money(sales), l: "近 60 天销售额", gold: true },
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
      '<table class="stat-days"><thead><tr><th>日期</th><th>访问</th><th class="bar-cell"></th><th>下单</th><th>销售额</th></tr></thead><tbody>' +
      last14.map(function (k) {
        const d2 = days[k] || { views: 0, orders: 0, amount: 0 };
        const w = Math.max(1.5, Math.round(d2.views / maxDay * 100));
        return "<tr><td>" + k + (k === today ? "（今天）" : "") + "</td><td><b>" + d2.views + "</b></td>" +
          '<td class="bar-cell"><div class="bar"><i style="width:' + w + '%"></i></div></td><td>' + d2.orders + "</td>" +
          "<td>" + money(d2.amount) + "</td></tr>";
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
      '<tr data-cat-id="' + id + '" draggable="true">' +
      '<td class="drag-handle" title="按住拖动排序">⠿</td>' +
      '<td><input class="cat-es" type="text" value="' + (c ? U.escapeHTML(c.name_es) : "") + '" placeholder="Ej: Entradas" /></td>' +
      '<td><input class="cat-zh" type="text" value="' + (c ? U.escapeHTML(c.name_zh || "") : "") + '" placeholder="可选" /></td>' +
      '<td><input class="cat-sort num" type="number" value="' + (c ? U.escapeHTML(String(c.sort_order || 0)) : cats.length + 1) + '" /></td>' +
      '<td><div class="row-actions">' +
      (c ? '<button type="button" class="btn btn-sm btn-ghost cat-mv" data-dir="-1" title="上移">↑</button>' +
        '<button type="button" class="btn btn-sm btn-ghost cat-mv" data-dir="1" title="下移">↓</button>' : "") +
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
  // 当前列表上显示的菜品（受“分类筛选 + 快速查找框”影响）——也作为编辑弹窗“上/下一个”的顺序
  function visibleDishes() {
    const filter = $("#dishFilter").value;
    const q = String(($("#dishSearch") && $("#dishSearch").value) || "").trim().toLowerCase();
    return dishes.filter((d) => {
      if (filter && d.category_id !== filter) return false;
      if (q) {
        const es = String(d.name_es || "").toLowerCase();
        const zh = String(d.name_zh || "").toLowerCase();
        if (es.indexOf(q) < 0 && zh.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function renderDishes() {
    const list = visibleDishes();
    const tbody = $("#dishRows");
    if (!list.length) {
      tbody.innerHTML = "";
      $("#dishEmpty").style.display = "block";
      updateDishNavButtons();
      return;
    }
    $("#dishEmpty").style.display = "none";
    tbody.innerHTML = list
      .map((d) => {
        const on = d.available !== false;
        return (
          '<tr data-dish-id="' + U.escapeHTML(d.id) + '" draggable="true">' +
          '<td class="drag-handle" title="按住拖动排序">⠿</td>' +
          "<td><b>" + U.escapeHTML(d.name_es) + "</b></td>" +
          "<td>" + U.escapeHTML(d.name_zh || "") + "</td>" +
          "<td>" + U.escapeHTML(catName(d.category_id)) + "</td>" +
          '<td class="price-inline">' + U.escapeHTML(U.formatCLP(d.price_clp)) + "</td>" +
          '<td style="text-align:center;">' +
          (on ? '<span class="badge badge-on">在售</span>' : '<span class="badge badge-off">已下架</span>') +
          "</td>" +
          '<td><input type="number" class="sort-inline" data-sort-id="' + U.escapeHTML(d.id) + '" value="' + U.escapeHTML(String(d.sort_order || 0)) + '" min="1" title="排序数字（越小越靠前）" /></td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-sm btn-ghost mv-btn" data-mv="' + U.escapeHTML(d.id) + '" data-dir="-1" title="上移">↑</button>' +
          '<button type="button" class="btn btn-sm btn-ghost mv-btn" data-mv="' + U.escapeHTML(d.id) + '" data-dir="1" title="下移">↓</button>' +
          '<button type="button" class="btn btn-sm btn-ghost edit-dish">编辑</button>' +
          '<button type="button" class="btn btn-sm btn-danger del-dish">删除</button>' +
          "</div></td></tr>"
        );
      })
      .join("");
    updateDishNavButtons();
  }

  /* ---------------- 菜品弹窗 ---------------- */
  /* ---------------- 菜品手动排序 ---------------- */
  function categoryDishList(catId) {
    return dishes.filter((d) => d.category_id === catId);
  }
  function displayOrderFor(catId) {
    return categoryDishList(catId).slice().sort(function (a, b) {
      const sa = a.sort_order || 0, sb = b.sort_order || 0;
      if (sa !== sb) return sa - sb;
      return a.name_es.localeCompare(b.name_es);
    });
  }
  // 新增菜品默认排到该分类最后
  function defaultSortFor(catId) {
    let max = 0;
    categoryDishList(catId).forEach((d) => { const n = d.sort_order || 0; if (n > max) max = n; });
    return max + 1;
  }
  async function renumberCategory(catId, ordered) {
    const updates = ordered.map((d, i) =>
      client.from("dishes").update({ sort_order: i + 1 }).eq("id", d.id)
    );
    await Promise.all(updates);
  }
  async function moveDish(id, dir) {
    const d = dishes.find((x) => x.id === id);
    if (!d || !client) return;
    const ordered = displayOrderFor(d.category_id);
    const idx = ordered.findIndex((x) => x.id === id);
    const t = idx + dir;
    if (t < 0 || t >= ordered.length) return;
    const tmp = ordered[idx]; ordered[idx] = ordered[t]; ordered[t] = tmp;
    try {
      await renumberCategory(d.category_id, ordered);
      toast("顺序已更新 ✅");
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }
  async function applySortInput(id, value) {
    const d = dishes.find((x) => x.id === id);
    if (!d || !client) return;
    d.sort_order = Math.max(1, U.toInt(value));
    const ordered = displayOrderFor(d.category_id);
    try {
      await renumberCategory(d.category_id, ordered);
      toast("顺序已更新 ✅");
      await refresh();
    } catch (e) { toast(errMsg(e), "err"); }
  }

  /* ---------------- 编辑弹窗：上/下一个菜品 + 未保存提醒 ---------------- */
  function updateDishNavButtons() {
    const prev = $("#dishModalPrev");
    const next = $("#dishModalNext");
    if (!prev || !next) return;
    const view = visibleDishes();
    const idx = editingDishId ? view.findIndex((d) => d.id === editingDishId) : -1;
    prev.disabled = idx <= 0;
    next.disabled = idx < 0 || idx >= view.length - 1;
  }
  function currentFormSnapshot() {
    return {
      category_id: $("#dishCategory").value,
      name_es: $("#dishNameEs").value.trim(),
      name_zh: $("#dishNameZh").value.trim(),
      price_clp: U.toInt($("#dishPrice").value),
      sort_order: U.toInt($("#dishSort").value),
      description: $("#dishDesc").value.trim(),
      image_url: $("#dishImage").value.trim(),
      available: $("#dishAvailable").checked,
    };
  }
  function dishObjectSnapshot(dish) {
    return {
      category_id: dish ? dish.category_id : null,
      name_es: dish ? dish.name_es || "" : "",
      name_zh: dish ? dish.name_zh || "" : "",
      price_clp: dish ? Number(dish.price_clp) || 0 : 0,
      sort_order: dish ? Number(dish.sort_order) || 0 : 0,
      description: dish ? dish.description || "" : "",
      image_url: dish ? dish.image_url || "" : "",
      available: dish ? dish.available !== false : true,
    };
  }
  function formDirty() {
    if (!editingSnapshot) return false;
    const a = editingSnapshot, b = currentFormSnapshot();
    return a.category_id !== b.category_id || a.name_es !== b.name_es ||
      a.name_zh !== b.name_zh || a.price_clp !== b.price_clp ||
      a.sort_order !== b.sort_order || a.description !== b.description ||
      a.image_url !== b.image_url || a.available !== b.available;
  }
  function dishNav(dir) {
    if (!editingDishId) return;
    const view = visibleDishes();
    const idx = view.findIndex((d) => d.id === editingDishId);
    if (idx < 0) return;
    const target = view[idx + dir];
    if (!target) return;
    if (formDirty() && !confirm("当前修改还未保存，确定放弃并切换到" + (dir < 0 ? "上一个" : "下一个") + "菜品？")) return;
    openDishModal(target);
  }
  function openDishModal(dish, preferredCatId) {
    editingDishId = dish ? dish.id : null;
    editingSnapshot = dish ? dishObjectSnapshot(dish) : null;
    $("#dishModalTitle").textContent = dish ? "编辑菜品" : "新增菜品";
    // 分类下拉
    const catSel = $("#dishCategory");
    catSel.innerHTML = cats
      .map((c) => '<option value="' + U.escapeHTML(c.id) + '">' + U.escapeHTML(c.name_es) + "</option>")
      .join("");
    const preferred = dish
      ? dish.category_id
      : preferredCatId || $("#dishFilter").value || (cats[0] && cats[0].id) || "";
    catSel.value = cats.some((c) => c.id === preferred) ? preferred : (cats[0] && cats[0].id) || "";

    $("#dishNameEs").value = dish ? dish.name_es : "";
    $("#dishNameZh").value = dish ? dish.name_zh || "" : "";
    $("#dishPrice").value = dish ? dish.price_clp : "";
    $("#dishSort").value = dish ? dish.sort_order || 0 : defaultSortFor(catSel.value);
    $("#dishDesc").value = dish ? dish.description || "" : "";
    $("#dishImage").value = dish ? dish.image_url || "" : "";
    showPreview($("#dishImage").value);
    setImgStatus("");
    $("#dishAvailable").checked = dish ? dish.available !== false : true;

    $("#dishModal").classList.add("show");
    updateDishNavButtons();
    setTimeout(() => $("#dishNameEs").focus(), 50);
  }
  function closeDishModal() {
    $("#dishModal").classList.remove("show");
    editingDishId = null;
    editingSnapshot = null;
    updateDishNavButtons();
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
        toast("菜品已保存 ✅（可继续修改；按 Esc/空格 或 ✕ 关闭）");
      } else {
        const { data: ins, error: insErr } = await client.from("dishes").insert(payload).select();
        if (insErr) throw insErr;
        editingDishId = ins && ins[0] ? ins[0].id : editingDishId;
        toast("菜品已添加 ✅（可继续录入下一道，或按 Esc/空格 关闭）");
      }
      await refresh();
      editingSnapshot = currentFormSnapshot();
      updateDishNavButtons();
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

  /* ---------------- 拖动排序（分类 + 菜品，保留 ↑/↓ 与数字框） ---------------- */
  function isEditableTarget(t) {
    return !!(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable === true));
  }

  /* ---- 分类排序 ---- */
  function renumberCatSortInputs() {
    const tb = $("#catRows");
    if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll("tr"), (tr, i) => {
      const inp = tr.querySelector(".cat-sort");
      if (inp) inp.value = i + 1;
    });
  }
  function syncCatArrayFromDom() {
    const tb = $("#catRows");
    if (!tb) return;
    const order = [];
    Array.prototype.forEach.call(tb.querySelectorAll("tr[data-cat-id]"), (tr) => {
      const id = tr.getAttribute("data-cat-id");
      if (id) order.push(id);
    });
    cats.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    cats.forEach((c, i) => { c.sort_order = i + 1; });
  }
  async function persistCatOrderFromDom() {
    if (!client) return;
    try {
      await Promise.all(
        cats.map((c) => client.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id))
      );
      toast("分类顺序已更新 ✅");
    } catch (e) {
      toast(errMsg(e), "err");
      await refresh();
    }
  }
  async function moveCatRow(btn) {
    if (!client) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const dir = parseInt(btn.getAttribute("data-dir"), 10) || 0;
    const tb = $("#catRows");
    const rows = Array.prototype.filter.call(tb.querySelectorAll("tr[data-cat-id]"), (r) => r.getAttribute("data-cat-id") !== "");
    const idx = rows.indexOf(tr);
    if (idx < 0) return;
    const t = idx + dir;
    if (t < 0 || t >= rows.length) return;
    tb.insertBefore(tr, dir < 0 ? rows[t] : rows[t].nextSibling);
    renumberCatSortInputs();
    syncCatArrayFromDom();
    await persistCatOrderFromDom();
  }
  let catDragRow = null;
  function clearCatDropMarks() {
    const tb = $("#catRows");
    if (tb) Array.prototype.forEach.call(tb.querySelectorAll("tr"), (tr) => tr.classList.remove("drop-before", "drop-after"));
  }
  function clearCatDragUI() {
    clearCatDropMarks();
    const tb = $("#catRows");
    if (tb) Array.prototype.forEach.call(tb.querySelectorAll("tr"), (tr) => tr.classList.remove("dragging"));
  }
  function bindCatDrag() {
    const tb = $("#catRows");
    if (!tb) return;
    tb.addEventListener("dragstart", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tr.getAttribute("data-cat-id") || isEditableTarget(e.target) || e.target.closest("button")) {
        e.preventDefault();
        return;
      }
      catDragRow = tr;
      tr.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", tr.getAttribute("data-cat-id") || "");
      } catch (err) { /* 某些浏览器限制 setData */ }
    });
    tb.addEventListener("dragover", (e) => {
      if (!catDragRow) return;
      const tr = e.target.closest("tr");
      if (!tr || tr === catDragRow || !tr.getAttribute("data-cat-id")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearCatDropMarks();
      const rect = tr.getBoundingClientRect();
      tr.classList.add(e.clientY > rect.top + rect.height / 2 ? "drop-after" : "drop-before");
    });
    tb.addEventListener("drop", (e) => {
      if (!catDragRow) return;
      e.preventDefault();
      const tr = e.target.closest("tr");
      if (tr && tr !== catDragRow && tr.getAttribute("data-cat-id")) {
        const rect = tr.getBoundingClientRect();
        tb.insertBefore(catDragRow, e.clientY > rect.top + rect.height / 2 ? tr.nextSibling : tr);
        renumberCatSortInputs();
        syncCatArrayFromDom();
        persistCatOrderFromDom();
      }
      catDragRow = null;
      clearCatDragUI();
    });
    tb.addEventListener("dragend", () => {
      catDragRow = null;
      clearCatDragUI();
    });
  }

  /* ---- 菜品拖动排序（同一分类内拖动） ---- */
  let dishDragRow = null;
  function dishRowCategoryId(tr) {
    const d = dishes.find((x) => x.id === tr.getAttribute("data-dish-id"));
    return d ? d.category_id : "";
  }
  function clearDishDropMarks() {
    const tb = $("#dishRows");
    if (tb) Array.prototype.forEach.call(tb.querySelectorAll("tr"), (tr) => tr.classList.remove("drop-before", "drop-after"));
  }
  function clearDishDragUI() {
    clearDishDropMarks();
    const tb = $("#dishRows");
    if (tb) Array.prototype.forEach.call(tb.querySelectorAll("tr"), (tr) => tr.classList.remove("dragging"));
  }
  async function commitDishOrderFromDom(catId) {
    if (!client) return;
    const tb = $("#dishRows");
    const byId = {};
    dishes.forEach((d) => { byId[d.id] = d; });
    const ordered = [];
    if (tb) {
      Array.prototype.forEach.call(tb.querySelectorAll("tr[data-dish-id]"), (tr) => {
        const d = byId[tr.getAttribute("data-dish-id")];
        if (d && d.category_id === catId) ordered.push(d);
      });
    }
    try {
      await renumberCategory(catId, ordered);
      toast("顺序已更新 ✅");
      await refresh();
    } catch (e) {
      toast(errMsg(e), "err");
      await refresh();
    }
  }
  function bindDishDrag() {
    const tb = $("#dishRows");
    if (!tb) return;
    tb.addEventListener("dragstart", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tr.getAttribute("data-dish-id") || isEditableTarget(e.target) || e.target.closest("button")) {
        e.preventDefault();
        return;
      }
      dishDragRow = tr;
      tr.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", tr.getAttribute("data-dish-id") || "");
      } catch (err) { /* 某些浏览器限制 setData */ }
    });
    tb.addEventListener("dragover", (e) => {
      if (!dishDragRow) return;
      const tr = e.target.closest("tr");
      if (!tr || tr === dishDragRow || !tr.getAttribute("data-dish-id")) return;
      if (dishRowCategoryId(tr) !== dishRowCategoryId(dishDragRow)) { clearDishDropMarks(); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDishDropMarks();
      const rect = tr.getBoundingClientRect();
      tr.classList.add(e.clientY > rect.top + rect.height / 2 ? "drop-after" : "drop-before");
    });
    tb.addEventListener("drop", async (e) => {
      if (!dishDragRow) return;
      e.preventDefault();
      const tr = e.target.closest("tr");
      const catId = dishRowCategoryId(dishDragRow);
      if (tr && tr !== dishDragRow && tr.getAttribute("data-dish-id") && dishRowCategoryId(tr) === catId) {
        const rect = tr.getBoundingClientRect();
        tb.insertBefore(dishDragRow, e.clientY > rect.top + rect.height / 2 ? tr.nextSibling : tr);
        await commitDishOrderFromDom(catId);
      }
      dishDragRow = null;
      clearDishDragUI();
    });
    tb.addEventListener("dragend", () => {
      dishDragRow = null;
      clearDishDragUI();
    });
  }
  /* ---------------- 店铺设置 ---------------- */
  function renderSettingsForm() {
    $("#set_store_name").value = settingsMap.store_name || "";
    $("#set_whatsapp").value = settingsMap.whatsapp_number || "";
    $("#set_address").value = settingsMap.address || "";
    $("#set_map_link").value = settingsMap.map_link || "";
    $("#set_hours").value = settingsMap.hours || "";
    $("#set_announcement").value = settingsMap.announcement || "";
  }
  async function saveSettings(e) {
    e.preventDefault();
    const entries = [
      ["store_name", $("#set_store_name").value.trim()],
      ["whatsapp_number", $("#set_whatsapp").value.trim()],
      ["address", $("#set_address").value.trim()],
      ["map_link", $("#set_map_link").value.trim()],
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

  /* ---------------- 取餐号：查看 / 手动纠正 ---------------- */
  function numRpcError(e) {
    const m = errMsg(e);
    return /does not exist|not exist|function|permission denied|permission/i.test(m)
      ? "取餐号功能还没开启：请先在 Supabase SQL Editor 运行 supabase/migration-ordernum.sql 最新版 SQL。"
      : m;
  }
  async function loadNumStatus() {
    if (!client) return;
    const msgEl = $("#numMsg");
    try {
      const { data, error } = await client.rpc("current_order_number");
      if (error) throw error;
      const cur = Number(data) || 0;
      $("#numCurrent").textContent = String(cur);
      $("#numNext").textContent = String(cur + 1);
      if (msgEl) msgEl.textContent = "";
    } catch (e) {
      if (msgEl) msgEl.textContent = numRpcError(e);
    }
  }
  async function applySetNumber() {
    if (!client) return;
    const input = $("#numSetInput");
    const v = U.toInt(input.value);
    if (input.value.trim() === "" || v < 0) { toast("请输入不小于 0 的号码", "err"); return; }
    try {
      const { data, error } = await client.rpc("set_order_number", { new_num: v });
      if (error) throw error;
      input.value = "";
      await loadNumStatus();
      toast("已把号码设为 #" + data + "，下一个顾客将是 #" + (Number(data) + 1) + " ✅");
    } catch (e) {
      toast("修改失败：" + numRpcError(e), "err");
    }
  }
  async function resetOrderNumber() {
    if (!client) return;
    if (!confirm("确定把取餐号重置为 0 吗？下一个顾客会自动从 #1 开始。")) return;
    try {
      const { error } = await client.rpc("reset_order_number");
      if (error) throw error;
      await loadNumStatus();
      toast("已重置为 0，下一个顾客将从 #1 开始 ✅");
    } catch (e) {
      toast("重置失败：" + numRpcError(e), "err");
    }
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
        else if (t.getAttribute("data-tab") === "num") loadNumStatus();
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
      else if (btn.classList.contains("cat-mv")) moveCatRow(btn);
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

    // 菜品筛选 + 快速查找
    $("#dishFilter").addEventListener("change", renderDishes);
    const dishSearchEl = $("#dishSearch");
    if (dishSearchEl) dishSearchEl.addEventListener("input", renderDishes);

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
      } else if (btn.classList.contains("mv-btn")) {
        moveDish(btn.getAttribute("data-mv"), parseInt(btn.getAttribute("data-dir"), 10) || 0);
      }
    });

    // 新增菜品
    $("#addDishBtn").addEventListener("click", () => {
      if (!cats.length) { toast("请先新增一个分类", "err"); return; }
      openDishModal(null);
    });

    // 编辑弹窗内直接新增另一道（不关闭弹窗）
    $("#dishModalNew").addEventListener("click", () => {
      if (!cats.length) { toast("请先新增一个分类", "err"); return; }
      openDishModal(null, $("#dishCategory").value);
    });

    // 拖动排序绑定
    bindCatDrag();
    bindDishDrag();

    // 排序数字输入：修改后自动保存
    $("#dishRows").addEventListener("change", (e) => {
      const inp = e.target.closest(".sort-inline");
      if (inp) applySortInput(inp.getAttribute("data-sort-id"), inp.value);
    });

    // 新增菜品时，切换分类自动给出该类最后的排序号
    $("#dishCategory").addEventListener("change", () => {
      if (!editingDishId) $("#dishSort").value = defaultSortFor($("#dishCategory").value);
    });

    // 弹窗
    $("#dishModalClose").addEventListener("click", closeDishModal);
    $("#dishModalCancel").addEventListener("click", closeDishModal);
    $("#dishModalSave").addEventListener("click", saveDish);
    $("#dishModalPrev").addEventListener("click", () => dishNav(-1));
    $("#dishModalNext").addEventListener("click", () => dishNav(1));
    $("#dishForm").addEventListener("submit", (e) => { e.preventDefault(); });
    $("#dishForm").addEventListener("keydown", (e) => {
      const t = e.target;
      if (e.key !== "Enter") return;
      // 备注框：回车=换行；Ctrl/Cmd+回车=保存
      if (t && t.tagName === "TEXTAREA") {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveDish(); }
        return;
      }
      // 下拉框/按钮：回车用于选中或触发，避免误保存
      if (t && (t.tagName === "SELECT" || t.tagName === "BUTTON")) return;
      e.preventDefault();
      saveDish();
    });

    // 完成菜品后：按 Esc / 空格 关闭编辑弹窗（在输入框里打空格不会触发）
    document.addEventListener("keydown", (e) => {
      const modal = $("#dishModal");
      if (!modal.classList.contains("show")) return;
      if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); dishNav(-1); return; }
      if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); dishNav(1); return; }
      if (e.key === "Escape") {
        e.preventDefault();
        closeDishModal();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable === true)) return;
        e.preventDefault();
        closeDishModal();
      }
    });

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

    // 取餐号：查看 / 手动修改 / 重置
    $("#numRefreshBtn").addEventListener("click", loadNumStatus);
    $("#numSetBtn").addEventListener("click", applySetNumber);
    $("#numSetInput").addEventListener("keydown", (e) => { if (e.key === "Enter") applySetNumber(); });
    $("#numResetBtn").addEventListener("click", resetOrderNumber);

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
