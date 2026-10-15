export function whatsAppShareUrl(message, userAgent = '') {
  // Desktop protocol handlers can replace emoji with question marks. Keep UTF-8 in the web client.
  const mobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
  return `${mobile ? 'https://api.whatsapp.com/send/' : 'https://web.whatsapp.com/send'}?text=${encodeURIComponent(message)}`;
}

export async function copyWhatsAppMessage(message, clipboard) {
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(message); return true; } catch { return false; }
}
