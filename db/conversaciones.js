// db/conversaciones.js
require('dotenv').config();
const pool = require('./pool');
const { normalizarTelefonoWhatsApp, normalizarTexto } = require('../utils/normalizar');


/** Normaliza un id de WhatsApp a "DIGITOS@c.us" (descarta grupos) */
function normalizarTelefonoWhatsApp(t) {
  if (!t) return null;
  let s = String(t).trim();

  // Ignorar grupos
  if (/@g\.us$/i.test(s)) return null;

  // Si viene "54911...@c.us" o "...@s.whatsapp.net"
  const m = s.match(/^(\+?\d+)\@(c\.us|s\.whatsapp\.net)$/i);
  if (m) {
    const digits = m[1].replace(/\D+/g, '');
    return digits ? `${digits}@c.us` : null; // normalizamos a @c.us
  }

  // Si viene sólo dígitos (o con +/espacios), agregamos sufijo
  const digitsOnly = s.replace(/\D+/g, '');
  return digitsOnly ? `${digitsOnly}@c.us` : null;
}

/** Reintenta si el host devuelve límite de conexiones */
async function withRetry(fn, { tries = 5, delayMs = 300 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e);
      const isLimit =
        msg.includes('max_user_connections') ||
        msg.includes('Too many connections') ||
        msg.includes('ER_USER_LIMIT_REACHED');
      if (!isLimit || i === tries - 1) {
        lastErr = e;
        break;
      }
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
  throw lastErr;
}

/**
 * guardarMensaje
 *  - (telefono, rol, mensaje)
 *  - ({ telefono, rol, mensaje })
 *  - (objeto venom: { from, body/text, fromMe, ... })
 */
async function guardarMensaje(a, b, c) {
  let telefono, rol, mensaje;

  if (typeof a === 'object' && a) {
    const m = a;
    telefono = m.telefono ?? m.from ?? m.chatId ?? '';
    rol      = m.rol ?? (m.fromMe ? 'assistant' : 'user');
    mensaje  = m.mensaje ?? m.body ?? m.text ?? m.caption ?? '';
  } else {
    telefono = a;
    rol = b;
    mensaje = c;
  }

  telefono = normalizarTelefonoWhatsApp(telefono);
  if (!telefono) {
    // Evita "Column 'telefono' cannot be null"
    throw new Error('telefono normalizado inválido (null)');
  }

  rol     = (rol === 'assistant' || rol === 'system') ? rol : 'user';
  mensaje = (mensaje == null) ? null : String(mensaje);

  const sql = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  const params = [telefono, rol, mensaje].map(v => (v === undefined ? null : v));

  await withRetry(() => pool.execute(sql, params));
}

/** Devuelve historial (últimos N) para un teléfono */
async function obtenerHistorial(telefono, cantidad = 6) {
  const tel = normalizarTelefonoWhatsApp(telefono);
  if (!tel) return [];

  const sql = `
    SELECT rol, mensaje, created_at
    FROM ll_ia_conversaciones
    WHERE telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const params = [tel, Number(cantidad)];
  const [rows] = await withRetry(() => pool.execute(sql, params));
  return rows.reverse(); // cronológicamente ascendente
}

module.exports = { guardarMensaje, obtenerHistorial, normalizarTelefonoWhatsApp };
