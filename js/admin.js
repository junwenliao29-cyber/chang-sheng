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
    $("#dishAvailable").checked = dish ? dish.available !== false : true;

    $("#dishModal").classList.add("show");
    setTimeout(() => $("#dishNameEs").focus(), 50);
  }
  function closeDishModal() {
    $("#dishModal").classList.remove("show");
    editingDishId = null;
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
    $("#dishModal").addEventListener("click", (e) => { if (e.target === $("#dishModal")) closeDishModal(); });
    $("#dishModalSave").addEventListener("click", saveDish);
    $("#dishForm").addEventListener("submit", (e) => { e.preventDefault(); saveDish(); });

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
