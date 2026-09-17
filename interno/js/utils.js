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


  // 生成发送到 WhatsApp 的订单文本（堂食版：桌号 + 小计/小费/总价）
  function buildOrderText(storeName, lines, info) {
    let msg = "Hola " + storeName + "! Quiero hacer un pedido:\n\n" + lines.join("\n");
    if (info.subtotalCLP !== undefined && info.subtotalCLP !== null) {
      msg += "\n\nSubtotal: " + formatCLP(Number(info.subtotalCLP));
    }
    if (info.tipCLP) msg += "\nPropina sugerida (10%): " + formatCLP(Number(info.tipCLP));
    if (info.totalCLP !== undefined && info.totalCLP !== null && !isNaN(Number(info.totalCLP))) {
      msg += "\n*Total: " + formatCLP(Number(info.totalCLP)) + "*";
    }
    msg += "\n\n*Mesa: " + (info.table || "-") + "*";
    if (info.name) msg += "\nNombre: " + info.name;
    if (info.orderNumber) msg += "\nNº de pedido: *#" + info.orderNumber + "*";
    if (info.address) msg += "\nDirección: " + info.address;
    if (info.location) msg += "\nUbicación: " + info.location;
    if (info.note) msg += "\nNota: " + info.note;
    msg += "\n\n¡Gracias!";
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
