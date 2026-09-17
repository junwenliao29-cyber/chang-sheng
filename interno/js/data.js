/* ============================================================
 * 数据层（堂食版）
 *  - 食品分类/菜品：从旧店同一个 Supabase 读取（后台改一次，两站同步）
 *  - 汽水/酒水/果汁：从本仓库 content/bebidas-local.json 读取
 *    （堂食独立价格，改这里不影响外卖站）
 * ============================================================ */
(function () {
  const cfg = window.APP_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const supabaseLib = window.supabase;
  const LOCAL_DRINKS_URL = "content/bebidas-local.json";
  const DRINK_RE = /BEBER|BEBIDA|JUGO|JUGOS|CERVEZA|VINO|TRAGO|ALCOHOL|SOLO PARA LLEVAR/i;

  let client = null;
  if (configured && supabaseLib) {
    client = supabaseLib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  async function loadJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }

  async function loadLocalDrinks() {
    try {
      const data = await loadJSON(LOCAL_DRINKS_URL);
      return { categories: data.categories || [], dishes: data.dishes || [] };
    } catch (e) {
      return { categories: [], dishes: [] };
    }
  }

  function isDrinkCategory(c) {
    return DRINK_RE.test(c.name_es || "") || DRINK_RE.test(c.name_zh || "");
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
    const foodCats = (catRes.data || []).filter(function (c) { return !isDrinkCategory(c); });
    const foodIds = new Set(foodCats.map(function (c) { return c.id; }));
    const foodDishes = (dishRes.data || []).filter(function (d) { return foodIds.has(d.category_id); });
    const local = await loadLocalDrinks();
    return {
      settings: settings,
      categories: foodCats.concat(local.categories),
      dishes: foodDishes.concat(local.dishes),
    };
  }

  async function loadDemoMenu() {
    const demo = window.DEMO_DATA || { settings: {}, categories: [], dishes: [] };
    const demoCats = (demo.categories || []).filter(function (c) { return !isDrinkCategory(c); });
    const demoIds = new Set(demoCats.map(function (c) { return c.id; }));
    const demoDishes = (demo.dishes || []).filter(function (d) { return demoIds.has(d.category_id); });
    const local = await loadLocalDrinks();
    return {
      settings: Object.assign({}, demo.settings),
      categories: demoCats.concat(local.categories),
      dishes: demoDishes.concat(local.dishes),
    };
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
