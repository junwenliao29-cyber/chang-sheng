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
  // 记录访问/下单：同一个浏览器同一天只记一次，避免刷新重复计数
  function trackEvent(type) {
    let client = null;
    try { client = window.Data && window.Data.getClient ? window.Data.getClient() : null; } catch (e) {}
    if (!client) return;
    const flag = "cs_" + type + "_" + todayLocalKey();
    try {
      if (localStorage.getItem(flag)) return;
      client
        .from("events")
        .insert({ type: type, session_id: getSessionId() })
        .then((res) => {
          if (!res.error) { try { localStorage.setItem(flag, "1"); } catch (e2) {} }
        })
        .catch(() => {});
    } catch (e) { /* 统计失败不影响正常使用 */ }
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
  function bindOrderForm() {
    // 自取 / 配送切换
    document.querySelectorAll(".radio-chip").forEach((chip) => {
      chip.addEventListener("click", function () {
        state.orderType = this.getAttribute("data-type");
        document.querySelectorAll(".radio-chip").forEach((c) => c.classList.toggle("active", c === this));
        const addr = $("#addrField");
        const label = $("#addrLabel");
        const input = $("#custAddr");
        if (state.orderType === "despacho") {
          addr.classList.remove("hidden");
          label.textContent = "Dirección de entrega *";
          input.placeholder = "Ej: Av. Providencia 1234, depto 5, Santiago";
          input.setAttribute("required", "required");
        } else {
          addr.classList.add("hidden");
          label.textContent = "Dirección de entrega";
          input.removeAttribute("required");
        }
      });
    });

    // 提交订单
    $("#waOrderBtn").addEventListener("click", function () {
      const name = $("#custName").value.trim();
      if (!name) {
        alert("Por favor escribe tu nombre."); // eslint-disable-line no-alert
        $("#custName").focus();
        return;
      }
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
      const lines = cart.map(
        (it, i) => i + 1 + ". " + it.name_es + " x" + it.qty
      );
      const s = menu.settings || {};
      const storeName = s.store_name || "CHANG SHENG";
      const phone = s.whatsapp_number || "56954663415";

      const msg = U.buildOrderText(storeName, lines, {
        name: name,
        type: state.orderType === "despacho" ? "Despacho a domicilio" : "Retiro en local",
        address: address,
        note: note,
      });

      const url = U.waLink(phone, msg);
      window.open(url, "_blank", "noopener");
      trackEvent("order");
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
