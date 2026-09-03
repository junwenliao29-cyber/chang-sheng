/* ================= 昌盛 CHANG SHENG — 顾客网站逻辑 ================= */
(function () {
  "use strict";

  const U = window.Utils;
  const $ = (sel) => document.querySelector(sel);
  const CART_KEY = "changsheng_cart_v1";

  let menu = { settings: {}, categories: [], dishes: [] };
  let cart = loadCart();

  const state = {
    orderType: "retiro", // retiro | despacho
  };
  let lastOrderNumber = null; // 记住本次取餐号：顾客改单重发时沿用同一号码

  /* ---------------- 访问 / 下单统计 ---------------- */
  function getSessionId() {
    let sid = null;
    try { sid = localStorage.getItem("cs_sid"); } catch (e) {}
    if (!sid) {
      sid = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem("cs_sid", sid); } catch (e) {}
    }
    return sid;
  }
  function todayLocalKey() {
    const d = new Date();
    const p = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  // 购物车里这单的金额（按菜单价估算）
  function cartOrderAmount() {
    return cart.reduce((s, it) => s + (Number(it.price_clp) || 0) * it.qty, 0);
  }
  // 记录访问/下单：同一浏览器同一天只记一次；用 keepalive 保证跳转页面时也能送达
  function trackEvent(type, amount) {
    const cfg = window.APP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    const flag = "cs_" + type + "_" + todayLocalKey();
    try { if (localStorage.getItem(flag)) return; } catch (e) {}
    const payload = { type: type, session_id: getSessionId() };
    if (type === "order" && amount) payload.amount_clp = amount;
    const url = String(cfg.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/events";
    const headers = {
      apikey: cfg.supabaseAnonKey,
      Authorization: "Bearer " + cfg.supabaseAnonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    const mark = (ok) => { if (ok) { try { localStorage.setItem(flag, "1"); } catch (e2) {} } };
    try {
      fetch(url, { method: "POST", headers: headers, body: JSON.stringify(payload), keepalive: true })
        .then((r) => mark(r.ok || r.status === 201 || r.status === 200))
        .catch(() => {});
    } catch (e) { /* 统计失败不影响正常使用 */ }
  }
  // 下单成功后提示：可修改后重新发送
  function showSentNote(isRetiro, num) {
    const el = $("#sentNote");
    if (!el) return;
    const base = "Puedes cambiar cantidades o datos y pulsar enviar de nuevo.";
    el.textContent = isRetiro && num
      ? "✅ Tu pedido se abrió en WhatsApp con tu Nº #" + num + ". " + base
      : "✅ Tu pedido se abrió en WhatsApp. " + base;
    el.classList.remove("hidden");
  }

  /* ---------------- 购物车 localStorage ---------------- */
  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) { /* ignore */ }
  }
  function cartCount() {
    return cart.reduce((s, it) => s + it.qty, 0);
  }

  /* ---------------- 渲染店铺信息 ---------------- */
  function renderSettings() {
    const s = menu.settings || {};
    const storeName = s.store_name || "CHANG SHENG 昌盛";
    const phone = s.whatsapp_number || "56954663415";
    const waHref = U.waLink(phone, "");

    document.title = storeName + " · Comida China";
    // 顶部 / Hero / 页脚按钮号码统一更新
    ["topWaBtn", "heroWaBtn", "footWaBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = waHref;
    });

    // 公告
    const ann = $("#announcement");
    if (s.announcement && String(s.announcement).trim()) {
      ann.innerHTML = U.escapeHTML(s.announcement);
      ann.classList.remove("hidden");
    } else {
      ann.classList.add("hidden");
    }

    // 联系信息
    $("#contactAddress").textContent = s.address || "—";
    $("#contactHours").textContent = s.hours || "—";
    const wa = $("#contactWa");
    if (wa) wa.href = U.waLink(phone, "Hola! Quiero información sobre el menú.");

    // 演示模式提示
    const demo = $("#demoBar");
    if (demo) demo.classList.toggle("hidden", window.Data.isSupabaseConfigured());
  }

  /* ---------------- 渲染菜单 ---------------- */
  function renderMenu() {
    const root = $("#menuRoot");
    const nav = $("#catNav");

    if (!menu.categories.length || !menu.dishes.length) {
      root.innerHTML =
        '<div class="error-box"><p>🍜 Pronto tendremos el menú disponible.</p>' +
        "<p class='small muted'>Estamos preparando nuestros platos. ¡Escríbenos por WhatsApp mientras tanto!</p></div>";
      nav.innerHTML = "";
      return;
    }

    // 分类导航
    nav.innerHTML = menu.categories
      .map((c) =>
        '<a href="#cat-' + U.escapeHTML(c.id) + '">' + U.escapeHTML(c.name_es) +
        (c.name_zh ? '<span class="zh">' + U.escapeHTML(c.name_zh) + "</span>" : "") + "</a>"
      )
      .join("");

    // 菜单区
    let html = "";
    menu.categories.forEach((cat) => {
      const dishes = menu.dishes.filter((d) => d.category_id === cat.id);
      if (!dishes.length) return;
      html +=
        '<section class="menu-section" id="cat-' + U.escapeHTML(cat.id) + '">' +
        '<div class="cat-head"><h2>' + U.escapeHTML(cat.name_es) + "</h2>" +
        (cat.name_zh ? '<span class="zh">' + U.escapeHTML(cat.name_zh) + "</span>" : "") + "</div>" +
        '<div class="dish-grid">' +
        dishes.map(dishCardHTML).join("") +
        "</div></section>";
    });
    if (!html) {
      html =
        '<div class="error-box"><p>🍜 Pronto tendremos el menú disponible.</p>' +
        "<p class='small muted'>Estamos preparando nuestros platos.</p></div>";
    }
    root.innerHTML = html;
  }

  function dishPhotoHTML(d) {
    if (d.image_url) {
      return '<img src="' + U.escapeHTML(d.image_url) + '" alt="' + U.escapeHTML(d.name_es) + '" loading="lazy" onerror="this.remove()" />';
    }
    const ch = (d.name_zh || "").trim().charAt(0);
    return '<span class="ph-zh">' + U.escapeHTML(ch || "🥡") + "</span>";
  }

  function dishCardHTML(d) {
    const price = U.formatCLP(d.price_clp);
    const zh = d.name_zh ? '<span class="zh">' + U.escapeHTML(d.name_zh) + "</span>" : "";
    const desc = d.description
      ? '<p class="dish-desc">' + U.escapeHTML(d.description) + "</p>"
      : '<p class="dish-desc">&nbsp;</p>';
    const foot =
      d.available === false
        ? '<span class="tag-soldout">Agotado</span>'
        : '<button class="add-btn" data-add="' + U.escapeHTML(d.id) + '">+ Agregar</button>';
    const soldout = d.available === false;
    return (
      '<article class="dish-card' + (soldout ? ' soldout' : '') + '">' +
      '<div class="dish-photo">' + dishPhotoHTML(d) + "</div>" +
      '<div class="dish-body">' +
      '<div class="dish-top"><div class="dish-name">' + U.escapeHTML(d.name_es) + zh + "</div>" +
      '<div class="dish-price">' + price + "</div></div>" +
      desc +
      '<div class="dish-foot">' + foot + "</div>" +
      "</div></article>"
    );
  }

  /* ---------------- 购物车 UI ---------------- */
  function renderCart() {
    const count = cartCount();
    $("#cartCount").textContent = count;
    $("#cartFab").style.display = count ? "" : "none";

    const linesEl = $("#cartLines");
    const emptyEl = $("#cartEmpty");
    const orderArea = $("#orderArea");

    if (!count) {
      linesEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      orderArea.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    orderArea.classList.remove("hidden");

    linesEl.innerHTML = cart
      .map((it) => {
        const zh = it.name_zh ? '<span class="zh">' + U.escapeHTML(it.name_zh) + "</span>" : "";
        return (
          '<div class="cart-line" data-id="' + U.escapeHTML(it.dishId) + '">' +
          '<div class="cart-line-info">' +
          '<div class="cart-line-name">' + U.escapeHTML(it.name_es) + zh + "</div>" +
          '<div class="qty">' +
          '<button type="button" data-dec="' + U.escapeHTML(it.dishId) + '" aria-label="Menos">−</button>' +
          "<span>" + it.qty + "</span>" +
          '<button type="button" data-inc="' + U.escapeHTML(it.dishId) + '" aria-label="Más">+</button>' +
          "</div>" +
          "</div>" +
          '<div class="cart-line-right">' +
          '<button type="button" class="cart-line-remove" data-del="' + U.escapeHTML(it.dishId) + '" aria-label="Quitar">🗑</button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  function openCart() {
    $("#cartDrawer").classList.add("open");
    $("#overlay").classList.add("show");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    $("#cartDrawer").classList.remove("open");
    $("#overlay").classList.remove("show");
    document.body.style.overflow = "";
  }

  function addDish(id) {
    const dish = menu.dishes.find((d) => d.id === id);
    if (!dish || dish.available === false) return;
    const found = cart.find((it) => it.dishId === id);
    if (found) found.qty += 1;
    else
      cart.push({
        dishId: dish.id,
        name_es: dish.name_es,
        name_zh: dish.name_zh || "",
        price_clp: Number(dish.price_clp) || 0,
        qty: 1,
      });
    saveCart();
    renderCart();
    // 加一点反馈
    const btn = document.querySelector('[data-add="' + CSS.escape(id) + '"]');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = "✓ Agregado";
      setTimeout(() => { btn.textContent = old; }, 700);
    }
  }
  function changeQty(id, delta) {
    const it = cart.find((c) => c.dishId === id);
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) cart = cart.filter((c) => c.dishId !== id);
    saveCart();
    renderCart();
  }
  function removeLine(id) {
    cart = cart.filter((c) => c.dishId !== id);
    saveCart();
    renderCart();
  }

  /* ---------------- 下单表单 ---------------- */
  /* ---------------- 下单表单：自取=取餐号 / 配送=名字 ---------------- */
  // 根据“自取/配送”切换显示：自取显示取餐号，配送显示姓名+地址
  function applyOrderTypeUI() {
    const isRetiro = state.orderType === "retiro";
    $("#nameField").classList.toggle("hidden", isRetiro);
    $("#numField").classList.toggle("hidden", !isRetiro);
    $("#custNum").value = "";
    const addr = $("#addrField");
    const input = $("#custAddr");
    if (isRetiro) {
      addr.classList.add("hidden");
      $("#addrLabel").textContent = "Dirección de entrega";
      input.removeAttribute("required");
      $("#custName").removeAttribute("required");
    } else {
      addr.classList.remove("hidden");
      $("#addrLabel").textContent = "Dirección de entrega *";
      input.setAttribute("required", "required");
      $("#custName").setAttribute("required", "required");
    }
    document.querySelectorAll(".radio-chip").forEach((c) =>
      c.classList.toggle("active", c.getAttribute("data-type") === state.orderType)
    );
  }

  // 取号：连接数据库时用服务器原子计数器（不重复不乱序）；
  // 演示模式（未连数据库）则用本机临时计数，仅供预览
  async function allocateOrderNumber() {
    let client = null;
    try { client = window.Data && window.Data.getClient ? window.Data.getClient() : null; } catch (e) {}
    if (client) {
      const { data, error } = await client.rpc("next_order_number");
      if (error) throw error;
      return Number(data);
    }
    let n = 0;
    try { n = parseInt(localStorage.getItem("cs_demo_num") || "0", 10) || 0; } catch (e) {}
    n += 1;
    try { localStorage.setItem("cs_demo_num", String(n)); } catch (e) {}
    return n;
  }

  function bindOrderForm() {
    // 自取 / 配送切换
    document.querySelectorAll(".radio-chip").forEach((chip) => {
      chip.addEventListener("click", function () {
        state.orderType = this.getAttribute("data-type");
        applyOrderTypeUI();
      });
    });

    // 提交订单
    let submitting = false;
    $("#waOrderBtn").addEventListener("click", async function () {
      if (submitting) return;
      const btn = this;
      const origText = btn.textContent;
      const isRetiro = state.orderType === "retiro";

      // 配送：需要姓名
      let name = "";
      if (!isRetiro) {
        name = $("#custName").value.trim();
        if (!name) {
          alert("Por favor escribe tu nombre."); // eslint-disable-line no-alert
          $("#custName").focus();
          return;
        }
      }
      // 配送：需要地址
      let address = "";
      if (state.orderType === "despacho") {
        address = $("#custAddr").value.trim();
        if (!address) {
          alert("Por favor escribe tu dirección de entrega."); // eslint-disable-line no-alert
          $("#custAddr").focus();
          return;
        }
      }
      const note = $("#custNote").value.trim();

      // 自取取号：第一次发送时取号；修改后重发沿用同一个号，不再占新号
      let orderNumber = null;
      if (isRetiro) {
        if (lastOrderNumber !== null) {
          orderNumber = lastOrderNumber;
        } else {
          submitting = true;
          btn.disabled = true;
          btn.textContent = "⏳ Asignando número…";
          let got = null;
          try {
            got = await allocateOrderNumber();
          } catch (e) { got = null; }
          submitting = false;
          btn.disabled = false;
          btn.textContent = origText;
          if (got === null || got === undefined || isNaN(got)) {
            alert("No se pudo asignar tu número de pedido. Revisa tu conexión e inténtalo de nuevo."); // eslint-disable-line no-alert
            return;
          }
          orderNumber = got;
          lastOrderNumber = got;
          $("#custNum").value = "#" + orderNumber;
        }
      }

      // WhatsApp 消息格式：*数量 菜名*（例如 *2 Carne Mongoliana con arroz*）
      const lines = cart.map(
        (it) => "*" + it.qty + " " + it.name_es + "*"
      );
      const s = menu.settings || {};
      const storeName = s.store_name || "CHANG SHENG";
      const phone = s.whatsapp_number || "56954663415";

      const msg = U.buildOrderText(storeName, lines, {
        name: name,
        type: state.orderType === "despacho" ? "Despacho a domicilio" : "Retiro en local",
        address: address,
        note: note,
        orderNumber: orderNumber,
      });

      const url = U.waLink(phone, msg);
      trackEvent("order", cartOrderAmount());
      // 自取取号发生在异步之后，用同页跳转避免浏览器拦截弹窗
      if (isRetiro) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
      showSentNote(isRetiro, orderNumber);
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    // 打开/关闭抽屉
    $("#cartFab").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    $("#overlay").addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart();
    });

    // 加菜（事件委托）
    $("#menuRoot").addEventListener("click", function (e) {
      const btn = e.target.closest("[data-add]");
      if (btn) addDish(btn.getAttribute("data-add"));
    });

    // 购物车行操作（事件委托）
    $("#cartLines").addEventListener("click", function (e) {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const del = e.target.closest("[data-del]");
      if (inc) changeQty(inc.getAttribute("data-inc"), 1);
      else if (dec) changeQty(dec.getAttribute("data-dec"), -1);
      else if (del) removeLine(del.getAttribute("data-del"));
    });
  }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    trackEvent("view");
    $("#year").textContent = new Date().getFullYear();
    bindEvents();
    bindOrderForm();
    applyOrderTypeUI();

    try {
      menu = await window.Data.loadMenu();
      renderSettings();
      renderMenu();
    } catch (err) {
      const loading = $("#loading");
      const errBox = $("#errorBox");
      if (loading) loading.classList.add("hidden");
      if (errBox) {
        errBox.classList.remove("hidden");
        $("#errorMsg").textContent = err && err.message ? err.message : String(err);
      }
    } finally {
      const loading = $("#loading");
      if (loading) loading.classList.add("hidden");
    }
    renderCart();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
