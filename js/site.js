/* ================= 昌盛 CHANG SHENG — 纯菜单网站逻辑 ================= */
(function () {
  "use strict";

  const U = window.Utils;
  const $ = (sel) => document.querySelector(sel);

  let menu = { settings: {}, categories: [], dishes: [] };

  /* ---------------- 访问统计（仅浏览人次，同一浏览器每天一次） ---------------- */
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
  function trackView() {
    const cfg = window.APP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    const flag = "cs_view_" + todayLocalKey();
    try { if (localStorage.getItem(flag)) return; } catch (e) {}
    const payload = { type: "view", session_id: getSessionId() };
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

  /* ---------------- 渲染店铺信息 ---------------- */
  function renderSettings() {
    const s = menu.settings || {};
    const storeName = s.store_name || "CHANG SHENG 昌盛";
    const phone = s.whatsapp_number || "56954663415";
    const waHref = U.waLink(phone, "Hola! Quiero hacer un pedido.");

    document.title = storeName + " · Comida China";
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
    if (wa) wa.href = U.waLink(phone, "Hola! Quiero hacer un pedido.");

    // Google Maps 位置链接（后台店铺设置里填写）
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

    nav.innerHTML = menu.categories
      .map((c) =>
        '<a href="#cat-' + U.escapeHTML(c.id) + '">' + U.escapeHTML(c.name_es) +
        (c.name_zh ? '<span class="zh">' + U.escapeHTML(c.name_zh) + "</span>" : "") + "</a>"
      )
      .join("");

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
    const soldout = d.available === false;
    const zh = d.name_zh ? '<span class="zh">' + U.escapeHTML(d.name_zh) + "</span>" : "";
    const desc = d.description
      ? '<p class="dish-desc">' + U.escapeHTML(d.description) + "</p>"
      : '<p class="dish-desc">&nbsp;</p>';
    const status = soldout ? '<span class="tag-soldout">Agotado</span>' : "";
    return (
      '<article class="dish-card' + (soldout ? " soldout" : "") + '">' +
      '<div class="dish-photo">' + dishPhotoHTML(d) + "</div>" +
      '<div class="dish-body">' +
      '<div class="dish-top"><div class="dish-name">' + U.escapeHTML(d.name_es) + zh + "</div>" +
      '<div class="dish-price">' + U.formatCLP(d.price_clp) + "</div></div>" +
      desc +
      status +
      "</div></article>"
    );
  }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    trackView();
    $("#year").textContent = new Date().getFullYear();

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
  }

  document.addEventListener("DOMContentLoaded", init);
})();
