/* ============================================================
 * 演示数据（仅当 Supabase 未配置时使用）
 * 与 supabase/seed.sql 里的示例内容保持一致，
 * 方便你在连接数据库前先本地预览网站效果。
 * ============================================================ */
window.DEMO_DATA = {
  settings: {
    store_name: "昌盛 CHANG SHENG",
    whatsapp_number: "56954663415",
    address: "Dirección del local — pendiente de configurar",
    hours: "12:00 – 22:00",
    announcement: "",
  },
  categories: [
    { id: "c-entradas", name_es: "Entradas", name_zh: "前菜", sort_order: 1 },
    { id: "c-sopas", name_es: "Sopas", name_zh: "汤类", sort_order: 2 },
    { id: "c-arroces", name_es: "Arroz y Tallarines", name_zh: "炒饭·炒面", sort_order: 3 },
    { id: "c-pollo", name_es: "Pollo", name_zh: "鸡肉", sort_order: 4 },
    { id: "c-cerdo-res", name_es: "Cerdo y Res", name_zh: "猪·牛", sort_order: 5 },
    { id: "c-mariscos", name_es: "Camarones y Mariscos", name_zh: "虾·海鲜", sort_order: 6 },
  ],
  dishes: [
    { id: "d-wantan-frito", category_id: "c-entradas", name_es: "Wantán Frito (6 un.)", name_zh: "炸云吞", description: "Crujientes wantanes rellenos de cerdo, con salsa agridulce.", price_clp: 4500, image_url: "", available: true, sort_order: 1 },
    { id: "d-rollo-primavera", category_id: "c-entradas", name_es: "Rollo de Primavera (2 un.)", name_zh: "春卷", description: "Rollo crujiente de verduras y cerdo.", price_clp: 3800, image_url: "", available: true, sort_order: 2 },
    { id: "d-jiaozi", category_id: "c-entradas", name_es: "Jiaozi / Empanaditas Chinas (6 un.)", name_zh: "饺子", description: "Empanaditas chinas rellenas de cerdo y verduras, al vapor o fritas.", price_clp: 5200, image_url: "", available: true, sort_order: 3 },

    { id: "d-sopa-wantan", category_id: "c-sopas", name_es: "Sopa Wantán", name_zh: "云吞汤", description: "Sopa clara con wantanes de cerdo y verduras.", price_clp: 5500, image_url: "", available: true, sort_order: 1 },
    { id: "d-sopa-pollo-maiz", category_id: "c-sopas", name_es: "Sopa de Pollo y Maíz", name_zh: "玉米鸡汤", description: "Sopa suave con pollo desmenuzado, maíz y huevo.", price_clp: 5800, image_url: "", available: true, sort_order: 2 },
    { id: "d-sopa-agripicante", category_id: "c-sopas", name_es: "Sopa Agripicante", name_zh: "酸辣汤", description: "Sopa espesa con un toque agrio y picante, tofu y champiñones.", price_clp: 5500, image_url: "", available: true, sort_order: 3 },
    { id: "d-sopa-tallarin-pollo", category_id: "c-sopas", name_es: "Sopa de Tallarines con Pollo", name_zh: "鸡汤面", description: "Fideos con pollo en un caldo aromático.", price_clp: 5900, image_url: "", available: true, sort_order: 4 },

    { id: "d-arroz-chaufa", category_id: "c-arroces", name_es: "Arroz Chaufa", name_zh: "炒饭", description: "Arroz salteado con pollo, cerdo, huevo y verduras.", price_clp: 5500, image_url: "", available: true, sort_order: 1 },
    { id: "d-arroz-chaufa-especial", category_id: "c-arroces", name_es: "Arroz Chaufa Especial", name_zh: "特色炒饭", description: "Arroz salteado con camarones, pollo, cerdo, huevo y verduras.", price_clp: 6800, image_url: "", available: true, sort_order: 2 },
    { id: "d-tallarin-saltado", category_id: "c-arroces", name_es: "Tallarín Saltado", name_zh: "炒面", description: "Tallarines salteados con verduras, pollo y cerdo.", price_clp: 6500, image_url: "", available: true, sort_order: 3 },
    { id: "d-tallarin-saltado-especial", category_id: "c-arroces", name_es: "Tallarín Saltado Especial", name_zh: "特色炒面", description: "Tallarines salteados con camarones y carnes.", price_clp: 7500, image_url: "", available: true, sort_order: 4 },

    { id: "d-pollo-kungpao", category_id: "c-pollo", name_es: "Pollo Kung Pao", name_zh: "宫保鸡丁", description: "Pollo salteado con maní, ají y salsa agripicante.", price_clp: 7500, image_url: "", available: true, sort_order: 1 },
    { id: "d-pollo-verduras", category_id: "c-pollo", name_es: "Pollo con Verduras", name_zh: "时蔬炒鸡", description: "Pollo salteado con verduras frescas.", price_clp: 7200, image_url: "", available: true, sort_order: 2 },
    { id: "d-pollo-agridulce", category_id: "c-pollo", name_es: "Pollo Agridulce", name_zh: "糖醋鸡", description: "Pollo crocante con salsa agridulce.", price_clp: 7200, image_url: "", available: true, sort_order: 3 },
    { id: "d-pollo-champinones", category_id: "c-pollo", name_es: "Pollo con Champiñones", name_zh: "蘑菇炒鸡", description: "Pollo salteado con champiñones y cebollín.", price_clp: 7200, image_url: "", available: true, sort_order: 4 },

    { id: "d-cerdo-agridulce", category_id: "c-cerdo-res", name_es: "Cerdo Agridulce", name_zh: "糖醋里脊", description: "Cerdo crocante con salsa agridulce y verduras.", price_clp: 7800, image_url: "", available: true, sort_order: 1 },
    { id: "d-res-brocoli", category_id: "c-cerdo-res", name_es: "Res con Brócoli", name_zh: "西兰花牛肉", description: "Trozos de res salteados con brócoli.", price_clp: 8500, image_url: "", available: true, sort_order: 2 },
    { id: "d-cerdo-verduras", category_id: "c-cerdo-res", name_es: "Cerdo con Verduras", name_zh: "时蔬炒肉", description: "Cerdo salteado con verduras frescas.", price_clp: 7800, image_url: "", available: true, sort_order: 3 },
    { id: "d-res-ostiones", category_id: "c-cerdo-res", name_es: "Res con Salsa de Ostiones", name_zh: "蚝油牛肉", description: "Res salteada con salsa de ostiones y cebolla.", price_clp: 8800, image_url: "", available: true, sort_order: 4 },

    { id: "d-camarones-verduras", category_id: "c-mariscos", name_es: "Camarones con Verduras", name_zh: "时蔬炒虾", description: "Camarones salteados con verduras frescas.", price_clp: 9500, image_url: "", available: true, sort_order: 1 },
    { id: "d-camarones-agridulce", category_id: "c-mariscos", name_es: "Camarones Agridulces", name_zh: "糖醋虾", description: "Camarones crocantes con salsa agridulce.", price_clp: 9500, image_url: "", available: true, sort_order: 2 },
    { id: "d-chaufa-camarones", category_id: "c-mariscos", name_es: "Arroz Chaufa con Camarones", name_zh: "虾仁炒饭", description: "Arroz salteado con camarones, huevo y verduras.", price_clp: 7500, image_url: "", available: true, sort_order: 3 },
    { id: "d-salteado-mariscos", category_id: "c-mariscos", name_es: "Salteado de Mariscos", name_zh: "海鲜炒", description: "Mix de mariscos salteados con verduras frescas.", price_clp: 10500, image_url: "", available: true, sort_order: 4 },
  ],
};
