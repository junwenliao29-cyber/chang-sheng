/* ============================================================
 * 数据层：演示模式 / Supabase 模式自动切换
 *  - Supabase 未配置：返回内置演示数据（js/demo-data.js）
 *  - Supabase 已配置：读取 Supabase 里的真实菜单
 * 表结构请先在 Supabase SQL Editor 运行 supabase/schema.sql
 * ============================================================ */
(function () {
  const cfg = window.APP_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const supabaseLib = window.supabase; // 由 <script> CDN 注入

  let client = null;
  if (configured && supabaseLib) {
    client = supabaseLib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  function parseDineinOnly(raw) {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function filterDineinOnly(categories, dishes, onlyIds) {
    const visibleCats = (categories || []).filter(function (c) { return onlyIds.indexOf(c.id) < 0; });
    const ids = {};
    visibleCats.forEach(function (c) { ids[c.id] = true; });
    const visibleDishes = (dishes || []).filter(function (d) { return ids[d.category_id]; });
    return { categories: visibleCats, dishes: visibleDishes };
  }

  async function loadMenuFromSupabase() {
    const [{ data: settingsRows, error: errS }, { data: categories, error: errC }, { data: dishes, error: errD }] =
      await Promise.all([
        client.from("settings").select("*"),
        client.from("categories").select("*").order("sort_order", { ascending: true }).order("name_es"),
        client.from("dishes").select("*").order("sort_order", { ascending: true }).order("name_es"),
      ]);
    if (errS || errC || errD) {
      const msg = (errS || errC || errD || {}).message || "Error de base de datos";
      throw new Error(msg);
    }
    const settings = {};
    (settingsRows || []).forEach(function (row) { settings[row.key] = row.value; });
    const onlyIds = parseDineinOnly(settings.dinein_only_categories);
    const vis = filterDineinOnly(categories, dishes, onlyIds);
    return { settings: settings, categories: vis.categories, dishes: vis.dishes };
  }

  function loadDemoMenu() {
    const demo = window.DEMO_DATA || { settings: {}, categories: [], dishes: [] };
    const settings = Object.assign({}, demo.settings);
    const onlyIds = parseDineinOnly(settings.dinein_only_categories);
    const vis = filterDineinOnly(demo.categories, demo.dishes, onlyIds);
    return { settings: settings, categories: vis.categories, dishes: vis.dishes };
  }

  window.Data = {
    isSupabaseConfigured: function () { return configured && !!client; },
    getClient: function () { return client; },
    async loadMenu() {
      if (configured && client) {
        return await loadMenuFromSupabase();
      }
      return loadDemoMenu();
    },
  };
})();
