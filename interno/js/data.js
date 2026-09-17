/* ============================================================
 * 数据层（内部堂食版）
 *  - 食品 + 饮料 都从旧店同一个 Supabase 读取（后台改一次两站同步）
 *  - 饮料堂食价存在 settings.dinein_prices（JSON：{菜品id: 堂食价}）
 *    在后台「🥤 饮料价格」标签页设置；没设置时自动用外卖价
 * ============================================================ */
(function () {
  const cfg = window.APP_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const supabaseLib = window.supabase;
  const DRINK_RE = /BEBER|BEBIDA|JUGO|JUGOS|CERVEZA|VINO|TRAGO|ALCOHOL|SOLO PARA LLEVAR/i;
  let client = null;
  if (configured && supabaseLib) client = supabaseLib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  function isDrinkCategory(c) {
    return !!c && (DRINK_RE.test(c.name_es || "") || DRINK_RE.test(c.name_zh || ""));
  }
  function parseDineinPrices(raw) {
    try {
      const m = JSON.parse(raw || "{}");
      return m && typeof m === "object" ? m : {};
    } catch (e) { return {}; }
  }
  function parseDineinCustom(raw) {
    try {
      const o = JSON.parse(raw || "{}");
      return {
        categories: Array.isArray(o.categories) ? o.categories : [],
        dishes: Array.isArray(o.dishes) ? o.dishes : [],
      };
    } catch (e) { return { categories: [], dishes: [] }; }
  }
  function applyDineInPrices(categories, dishes, dineMap) {
    const byId = {};
    (categories || []).forEach(function (c) { byId[c.id] = c; });
    return (dishes || []).map(function (d) {
      const cat = byId[d.category_id];
      const dine = dineMap[d.id];
      if (isDrinkCategory(cat) && dine !== null && dine !== undefined && dine !== "") {
        return Object.assign({}, d, { price_clp: Number(dine) || 0 });
      }
      return d;
    });
  }

  async function loadMenuFromSupabase() {
    const [settingsRes, catRes, dishRes] = await Promise.all([
      client.from("settings").select("*"),
      client.from("categories").select("*").order("sort_order", { ascending: true }).order("name_es"),
      client.from("dishes").select("*").order("sort_order", { ascending: true }).order("name_es"),
    ]);
    if (settingsRes.error || catRes.error || dishRes.error) {
      const err = settingsRes.error || catRes.error || dishRes.error;
      throw new Error((err && err.message) || "Error de base de datos");
    }
    const settings = {};
    (settingsRes.data || []).forEach(function (row) { settings[row.key] = row.value; });
    const categories = catRes.data || [];
    const dineMap = parseDineinPrices(settings.dinein_prices);
    const dishes = applyDineInPrices(categories, dishRes.data || [], dineMap);
    const custom = parseDineinCustom(settings.dinein_custom_menu);
    return {
      settings: settings,
      categories: categories.concat(custom.categories),
      dishes: dishes.concat(custom.dishes),
    };
  }

  async function loadDemoMenu() {
    const demo = window.DEMO_DATA || { settings: {}, categories: [], dishes: [] };
    const categories = (demo.categories || []).slice();
    const dishes = applyDineInPrices(categories, (demo.dishes || []).slice(), {});
    return { settings: Object.assign({}, demo.settings), categories: categories, dishes: dishes };
  }

  window.Data = {
    isSupabaseConfigured: function () { return configured && !!client; },
    getClient: function () { return client; },
    async loadMenu() {
      if (configured && client) return await loadMenuFromSupabase();
      return await loadDemoMenu();
    },
  };
})();
