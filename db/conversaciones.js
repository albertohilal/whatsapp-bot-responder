// db/conversaciones.js
require('dotenv').config();
const pool = require('./pool');

/** Normaliza a solo dígitos (ej: "+54 9 11-1234 5678" -> "5491112345678") */
function normalizarTelefono(t) {
  if (!t) return '';
  return String(t).replace(/\D+/g, '');
}

/** Reintentos con backoff para límites de conexiones en hosting compartido */
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
      delayMs *= 2; // backoff exponencial
    }
  }
  throw lastErr;
}

/**
 * Guardar mensaje en la conversación.
 *
 * Soporta:
 *  - guardarMensaje(telefono, rol, mensaje)
 *  - guardarMensaje({ telefono, rol, mensaje })
 *  - guardarMensaje({ from, body, fromMe, ... })  // objeto crudo de venom
 */
async function guardarMensaje(a, b, c) {
  let telefono, rol, mensaje;

  if (typeof a === 'object' && a) {
    // Compat: objeto estilo venom o formato antiguo
    const m = a;
    telefono =
      m.telefono ||
      m.from ||
      (m.sender && (m.sender.id || m.sender.pushname || m.sender.formattedName)) ||
      '';
    rol = m.rol || (m.fromMe ? 'assistant' : 'user');
    mensaje = m.mensaje ?? m.body ?? m.text ?? '';
  } else {
    telefono = a;
    rol = b;
    mensaje = c;
  }

  // Normalización y sanitización
  telefono = normalizarTelefono(telefono) || null;
  rol = (rol === 'assistant' || rol === 'system') ? rol : 'user';
  mensaje = (mensaje == null) ? null : String(mensaje);

  const sql = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  // mysql2 NO acepta undefined en params
  let params = [telefono, rol, mensaje].map(v => (v === undefined ? null : v));

  try {
    await withRetry(() => pool.execute(sql, params));
  } catch (err) {
    console.error('❌ Error guardando mensaje:', err?.message || err, { params });
  }
}

/**
 * Devuelve el historial (últimos N) para un teléfono.
 * @param {string} telefono
 * @param {number} cantidad  (por defecto 6)
 */
async function obtenerHistorial(telefono, cantidad = 6) {
  const tel = normalizarTelefono(telefono);
  const sql = `
    SELECT rol, mensaje, created_at
    FROM ll_ia_conversaciones
    WHERE telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const params = [tel, Number(cantidad)];

  const [rows] = await withRetry(() => pool.execute(sql, params));
  // Mostrar en orden cronológico ascendente
  return rows.reverse();
}

module.exports = { guardarMensaje, obtenerHistorial };
