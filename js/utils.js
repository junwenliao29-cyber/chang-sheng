/* 通用小工具：价格格式、HTML 转义、WhatsApp 链接等 */
window.Utils = (function () {
  // 智利比索格式：4500 -> "$4.500"
  function formatCLP(n) {
    const num = Number(n) || 0;
    return "$" + num.toLocaleString("es-CL");
  }

  // 转义 HTML，防止菜单内容里的特殊字符破坏页面
  function escapeHTML(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 把电话号码整理成国际格式（去掉空格/+/-），例如 +56 9 5466 3415 -> 56954663415
  function normalizePhone(phone) {
    return String(phone || "").replace(/[^\d]/g, "");
  }

  // 生成 WhatsApp 跳转链接
  function waLink(phone, text) {
    const digits = normalizePhone(phone) || "56954663415";
    const base = "https://wa.me/" + digits;
    if (!text) return base;
    return base + "?text=" + encodeURIComponent(text);
  }

  // 只保留数字输入
  function toInt(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }


  // 生成发送到 WhatsApp 的订单文本（不写价格，由老板自己算总账）
  // lines: 数组，如 ["1. Arroz Chaufa x2", ...]
  // info:  { name, type, address, note, orderNumber }
  function buildOrderText(storeName, lines, info) {
    let msg =
      "Hola " + storeName + "! Quiero hacer un pedido:\n\n" +
      lines.join("\n") +
      "\n\n" + (info.orderNumber ? "Nº de pedido: #" + info.orderNumber : "Nombre: " + (info.name || "")) +
      "\nTipo: " + (info.type || "");
    if (info.address) msg += "\nDirección: " + info.address;
    if (info.note) msg += "\nNota: " + info.note;
    msg += "\n\nEl total te lo confirmamos por WhatsApp. ¡Gracias!";
    return msg;
  }

  return {
    formatCLP: formatCLP,
    buildOrderText: buildOrderText,
    escapeHTML: escapeHTML,
    normalizePhone: normalizePhone,
    waLink: waLink,
    toInt: toInt,
  };
})();
