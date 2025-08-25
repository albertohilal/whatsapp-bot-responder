// db/conversaciones.js
require('dotenv').config();
const pool = require('./pool');

// Tabla actual: ll_ia_conversaciones (telefono, rol, mensaje, created_at)
// Si querés, descomenta la siguiente función para crearla si no existe.
// OJO: en hosting compartido puede que no tengas permisos para CREATE.
/*
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS ll_ia_conversaciones (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      telefono VARCHAR(32) NOT NULL,
      rol ENUM('user','assistant','system') NOT NULL DEFAULT 'user',
      mensaje TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_tel_created (telefono, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await pool.query(sql);
}
*/

async function withRetry(fn, { tries = 5, delayMs = 300 } = {}) {
  let err;
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
        err = e;
        break;
      }
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2; // backoff exponencial
    }
  }
  throw err;
}

/**
 * Guarda un mensaje en la conversación.
 * @param {string} telefono
 * @param {'user'|'assistant'|'system'} rol
 * @param {string} mensaje
 */
async function guardarMensaje(telefono, rol, mensaje) {
  const sql = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  const params = [telefono, rol, mensaje];

  await withRetry(() => pool.execute(sql, params));
}

/**
 * Devuelve el historial (los últimos N mensajes) de un teléfono.
 * @param {string} telefono
 * @param {number} cantidad  cantidad de mensajes (por defecto 6)
 * @returns {Promise<Array<{rol:string,mensaje:string,created_at:Date}>>}
 */
async function obtenerHistorial(telefono, cantidad = 6) {
  const sql = `
    SELECT rol, mensaje, created_at
    FROM ll_ia_conversaciones
    WHERE telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const params = [telefono, Number(cantidad)];

  const [rows] = await withRetry(() => pool.execute(sql, params));
  // devolvemos en orden cronológico (antiguo → reciente)
  return rows.reverse();
}

// (Opcional) Llamá a ensureTable() una sola vez al inicio de tu app.
// ensureTable().catch(e => console.error('ensureTable error:', e?.message || e));

module.exports = { guardarMensaje, obtenerHistorial };
