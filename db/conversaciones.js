// db/conversaciones.js

const pool = require('./pool');
const { normalizarTelefonoWhatsApp } = require('../utils/normalizar');


async function guardarMensaje(telefonoInput, rol, mensaje) {
  const telefono = normalizarTelefonoWhatsApp(telefonoInput);
  if (!telefono || !rol || typeof mensaje !== 'string') {
    throw new Error(`Parámetros inválidos en guardarMensaje: ${JSON.stringify({ telefono, rol, mensaje })}`);
  }

  const sql = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  const params = [telefono, rol, mensaje];

  try {
    await pool.execute(sql, params);
  } catch (err) {
    console.error('❌ Error guardando mensaje:', err.message, '| params:', params);
    throw err;
  }
}


async function obtenerHistorial(telefonoInput, cantidad = 6) {
  const telefono = normalizarTelefonoWhatsApp(telefonoInput);
  const sql = `
    SELECT rol, mensaje, created_at
    FROM ll_ia_conversaciones
    WHERE telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const params = [telefono, Number(cantidad)];

  try {
    const [rows] = await pool.execute(sql, params);
    return rows || [];
  } catch (err) {
    console.error('❌ Error obteniendo historial:', err.message, '| params:', params);
    throw err;
  }
}

module.exports = {
  guardarMensaje,
  obtenerHistorial,
};
