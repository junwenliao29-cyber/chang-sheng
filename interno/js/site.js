/* ================= 昌盛 CHANG SHENG — 顾客网站逻辑 ================= */
(function () {
  "use strict";

  const U = window.Utils;
  const $ = (sel) => document.querySelector(sel);
  const CART_KEY = "changsheng_cart_v1";

  let menu = { settings: {}, categories: [], dishes: [] };
  let cart = loadCart();

  let tipEnabled = false;     // 是否加 10% 建议小费（智利常见）
  let justSent = false;       // 下单成功后清空购物车并显示感谢语
  const CART_EMPTY_DEFAULT = '<div class="big">🍽️</div>Tu carrito está vacío.<br />Agrega algunos platos del menú.';
  const CART_EMPTY_THANKS = '<div class="big">✅</div>¡Pedido enviado por WhatsApp!<br />Gracias 🧡 Si quieres hacer otro pedido, agrega platos de nuevo.';

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

    // 联系信息（内部版可能没有这些板块，需判空）
    const addrEl = $("#contactAddress");
    if (addrEl) addrEl.textContent = s.address || "—";
    const hoursEl = $("#contactHours");
    if (hoursEl) hoursEl.textContent = s.hours || "—";
    const wa = $("#contactWa");
    if (wa) wa.href = U.waLink(phone, "Hola! Quiero información sobre el menú.");

    // 联系卡：Google Maps 位置链接（后台“店铺设置”填写）
    const mapWrap = $("#contactMapWrap");
    const mapLink = $("#contactMapLink");
    if (mapWrap && mapLink) {
      const map = s.map_link || "";
      if (map && /^https?:\/\//i.test(map)) {
        mapLink.href = map;
        mapWrap.classList.remove("hidden");
      } else {
        mapWrap.classList.add("hidden");
      }
    }

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

  /* ---------------- 菜品搜索 ---------------- */
  function normalizeText(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  let searchTimer = null;
  function dishMatches(d, q) {
    return normalizeText(d.name_es).indexOf(q) >= 0 || normalizeText(d.name_zh).indexOf(q) >= 0;
  }
  function applyDishSearch() {
    const inp = $("#siteSearch");
    const clearBtn = $("#searchClearBtn");
    if (!inp) return;
    const q = normalizeText(inp.value).trim();
    const root = $("#menuRoot");
    const nav = $("#catNav");
    if (!q) {
      if (clearBtn) clearBtn.classList.add("hidden");
      renderMenu();
      return;
    }
    if (clearBtn) clearBtn.classList.remove("hidden");
    let navHtml = "";
    let html = "";
    let any = false;
    menu.categories.forEach((cat) => {
      const hits = menu.dishes.filter((d) => d.category_id === cat.id && dishMatches(d, q));
      if (!hits.length) return;
      any = true;
      navHtml += '<a href="#cat-' + U.escapeHTML(cat.id) + '">' + U.escapeHTML(cat.name_es) +
        (cat.name_zh ? '<span class="zh">' + U.escapeHTML(cat.name_zh) + "</span>" : "") + "</a>";
      html +=
        '<section class="menu-section" id="cat-' + U.escapeHTML(cat.id) + '">' +
        '<div class="cat-head"><h2>' + U.escapeHTML(cat.name_es) + "</h2>" +
        (cat.name_zh ? '<span class="zh">' + U.escapeHTML(cat.name_zh) + "</span>" : "") + "</div>" +
        '<div class="dish-grid">' + hits.map(dishCardHTML).join("") + "</div></section>";
    });
    nav.innerHTML = navHtml;
    if (!any) {
      html = '<div class="no-results"><div class="big">🔍</div><b>Sin resultados</b>' +
        '<p class="small muted">No encontramos “' + U.escapeHTML(inp.value.trim()) + '”. Prueba con otro nombre o en chino.</p></div>';
    }
    root.innerHTML = html;
  }
  function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyDishSearch, 120);
  }

  /* ---------------- 下单方式引导（今日不再提醒） ---------------- */
  const GUIDE_KEY = "cs_order_guide_off";
  function guideTodayKey() {
    const d = new Date();
    const p = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function maybeShowGuide() {
    try { if (localStorage.getItem(GUIDE_KEY) === guideTodayKey()) return; } catch (e) {}
    const g = $("#orderGuide");
    if (!g) return;
    setTimeout(() => {
      g.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }, 700);
  }
  function hideOrderGuide(rememberToday) {
    const g = $("#orderGuide");
    if (g) g.classList.add("hidden");
    document.body.style.overflow = "";
    if (rememberToday) {
      try { localStorage.setItem(GUIDE_KEY, guideTodayKey()); } catch (e) {}
    }
  }
  function bindGuide() {
    const g = $("#orderGuide");
    if (!g) return;
    const ok = $("#guideOkBtn");
    const close = $("#guideClose");
    const noToday = $("#guideNoToday");
    if (ok) ok.addEventListener("click", () => hideOrderGuide(noToday ? !!noToday.checked : false));
    if (close) close.addEventListener("click", () => hideOrderGuide(false));
    g.addEventListener("click", (e) => { if (e.target === g) hideOrderGuide(false); });
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
    // 购物车按钮常驻（有可点菜品就显示，空车也显示，方便电脑/手机随时入口）
    $("#cartFab").style.display = menu.dishes.some((d) => d.available !== false) ? "" : "none";

    const linesEl = $("#cartLines");
    const emptyEl = $("#cartEmpty");
    const orderArea = $("#orderArea");

    if (!count) {
      linesEl.innerHTML = "";
      emptyEl.innerHTML = justSent ? CART_EMPTY_THANKS : CART_EMPTY_DEFAULT;
      emptyEl.classList.remove("hidden");
      orderArea.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    orderArea.classList.remove("hidden");

    linesEl.innerHTML = cart
      .map((it) => {
        const zh = it.name_zh ? '<span class="zh">' + U.escapeHTML(it.name_zh) + "</span>" : "";
        const unit = U.escapeHTML(U.formatCLP(it.price_clp)) + " c/u";
        const priceInfo = '<div class="cart-line-price">' + unit + "</div>";
        const rightPrice = '<div class="cart-line-price"><b>' + U.escapeHTML(U.formatCLP(it.qty * it.price_clp)) + "</b></div>";
        return (
          '<div class="cart-line" data-id="' + U.escapeHTML(it.dishId) + '">' +
          '<div class="cart-line-info">' +
          '<div class="cart-line-name">' + U.escapeHTML(it.name_es) + zh + "</div>" +
          priceInfo +
          '<div class="qty">' +
          '<button type="button" data-dec="' + U.escapeHTML(it.dishId) + '" aria-label="Menos">−</button>' +
          "<span>" + it.qty + "</span>" +
          '<button type="button" data-inc="' + U.escapeHTML(it.dishId) + '" aria-label="Más">+</button>' +
          "</div>" +
          "</div>" +
          '<div class="cart-line-right">' +
          rightPrice +
          '<button type="button" class="cart-line-remove" data-del="' + U.escapeHTML(it.dishId) + '" aria-label="Quitar">🗑</button>' +
          "</div></div>"
        );
      })
      .join("");

    // 堂食：始终显示 小计 / 10% 建议小费 / 总价
    const subtotal = cartOrderAmount();
    const tipCLP = tipEnabled ? Math.round(subtotal * 0.1) : 0;
    const totalCLP = subtotal + tipCLP;
    const totalRow = $("#cartTotalRow");
    if (totalRow) totalRow.classList.remove("hidden");
    const subEl = $("#cartSubtotalText");
    if (subEl) subEl.textContent = U.formatCLP(subtotal);
    const tipRow = $("#tipRow");
    if (tipRow) tipRow.classList.toggle("hidden", !tipEnabled);
    const tipEl = $("#tipText");
    if (tipEl) tipEl.textContent = U.formatCLP(tipCLP);
    const tt = $("#cartTotalText");
    if (tt) tt.textContent = U.formatCLP(totalCLP);
    const noteEl = $("#orderNoteText");
    if (noteEl) noteEl.textContent = "Precios para consumo en el local. El pedido se confirma por WhatsApp.";
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
    if (justSent) justSent = false;
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

  /* ---------------- 堂食下单表单 ---------------- */
  function applyDineInUI() {
    // 支持每桌二维码：...?mesa=5 自动带出桌号
    let mesa = "";
    try {
      const params = new URLSearchParams(window.location.search);
      mesa = params.get("mesa") || params.get("table") || "";
    } catch (e) {}
    const t = $("#custTable");
    if (t && mesa && !t.value) t.value = String(mesa).replace(/[^\d]/g, "");
    renderCart();
  }

  function bindOrderForm() {
    const tip = $("#tip10");
    if (tip) tip.addEventListener("change", () => { tipEnabled = !!tip.checked; renderCart(); });

    $("#waOrderBtn").addEventListener("click", function () {
      const table = ($("#custTable").value || "").trim();
      if (!table || Number(table) < 1) {
        alert("Por favor escribe el número de tu mesa."); // eslint-disable-line no-alert
        $("#custTable").focus();
        return;
      }
      if (!cart.length) return;
      const nameEl = $("#custName");
      const name = nameEl ? (nameEl.value || "").trim() : "";
      const noteEl = $("#custNote");
      const note = noteEl ? (noteEl.value || "").trim() : "";
      const subtotal = cartOrderAmount();
      const tipCLP = tipEnabled ? Math.round(subtotal * 0.1) : 0;
      const total = subtotal + tipCLP;
      const lines = cart.map((it) =>
        "*" + it.qty + " " + it.name_es + "* — " + U.formatCLP(it.qty * (Number(it.price_clp) || 0))
      );
      const s = menu.settings || {};
      const storeName = s.store_name || "CHANG SHENG";
      const phone = s.whatsapp_number || "56954663415";
      const msg = U.buildOrderText(storeName, lines, {
        table: table,
        name: name,
        note: note,
        subtotalCLP: subtotal,
        tipCLP: tipCLP,
        totalCLP: total,
      });
      const url = U.waLink(phone, msg);
      trackEvent("order", total);
      cart = [];
      saveCart();
      justSent = true;
      const noteIn = $("#custNote"); if (noteIn) noteIn.value = "";
      renderCart();
      window.open(url, "_blank", "noopener");
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    bindInternalActions();

    // 打开/关闭抽屉
    $("#cartFab").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    $("#overlay").addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const guide = $("#orderGuide");
      if (guide && !guide.classList.contains("hidden")) { hideOrderGuide(false); return; }
      closeCart();
    });

    // 菜品搜索
    const searchInp = $("#siteSearch");
    if (searchInp) searchInp.addEventListener("input", scheduleSearch);
    const clearBtn = $("#searchClearBtn");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (searchInp) { searchInp.value = ""; applyDishSearch(); searchInp.focus(); }
    });

    // 下单引导
    bindGuide();

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

  function bindInternalActions() {
    const clear = () => {
      if (cart.length && !confirm("¿Vaciar el pedido actual? / 清空当前订单？")) return;
      cart = [];
      saveCart();
      justSent = false;
      const n = $("#custNote"); if (n) n.value = "";
      const t = $("#custTable"); if (t) t.value = "";
      renderCart();
      closeCart();
    };
    const top = $("#newOrderBtn");
    if (top) top.addEventListener("click", clear);
    const drawer = $("#clearOrderBtn");
    if (drawer) drawer.addEventListener("click", clear);
  }
  /* ---------------- 初始化 ---------------- */
  async function init() {
    trackEvent("view");
    const yearEl = $("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    bindEvents();
    bindOrderForm();
    applyDineInUI();

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
