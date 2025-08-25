// utils/normalizar.js

/**
 * Normaliza un JID/telefono de WhatsApp a formato canónico:
 *  - Si viene con sufijo "@c.us" lo preserva, pero normaliza el número
 *  - Si viene solo número, lo devuelve en E.164 sin guiones/espacios
 *  - Siempre quita caracteres no numéricos salvo + y @ sufijo
 */
function normalizarTelefonoWhatsApp(input) {
  if (!input) return null;

  // split posible JID
  const [numeroRaw, sufijo] = String(input).trim().split('@');
  // quitar todo lo que no sea dígito
  let num = (numeroRaw || '').replace(/\D/g, '');

  // heurística simple: si no empieza con 54 y es de AR con 11 dígitos que arrancan con 9 (formato WA),
  // lo dejamos; si tiene 10/11 dígitos sin prefijo país, podrías anteponer 54 según tu caso.
  // Aquí no imponemos país: solo limpiamos.
  if (!num) return null;

  return sufijo ? `${num}@${sufijo}` : num;
}

/**
 * Compara mensajes para filtrar duplicados (trim + lower)
 */
function mensajesIguales(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

module.exports = {
  normalizarTelefonoWhatsApp,
  mensajesIguales,
};
