// utils/normalizar.js

/**
 * Normaliza un id de WhatsApp al formato "DIGITOS@c.us".
 * - Descarta grupos (@g.us)
 * - Convierte @s.whatsapp.net a @c.us
 * - Si recibe solo dígitos (o con +/espacios), agrega el sufijo @c.us
 */
function normalizarTelefonoWhatsApp(t) {
  if (!t) return null;
  let s = String(t).trim();

  // Ignorar grupos
  if (/@g\.us$/i.test(s)) return null;

  // Si viene en formato JID
  const m = s.match(/^(\+?\d+)\@(c\.us|s\.whatsapp\.net)$/i);
  if (m) {
    const digits = m[1].replace(/\D+/g, '');
    return digits ? `${digits}@c.us` : null; // normalizamos a @c.us
  }

  // Si viene solo dígitos (o con +/espacios)
  const digitsOnly = s.replace(/\D+/g, '');
  return digitsOnly ? `${digitsOnly}@c.us` : null;
}

/** Normaliza texto a string “limpio” */
function normalizarTexto(txt) {
  if (txt == null) return '';
  return String(txt).trim();
}

module.exports = {
  normalizarTelefonoWhatsApp,
  normalizarTexto,
};
