// db/conversaciones.js

const pool = require('./pool');
const { normalizarTelefonoWhatsApp } = require('../utils/normalizar');


async function guardarMensaje(telefonoInput, rol, mensaje) {
  const telefono = normalizarTelefonoWhatsApp(telefonoInput);
  console.log('📝 guardarMensaje params:', { telefonoInput, telefono, rol, mensaje });
  // Solo validamos que haya teléfono y mensaje no vacío
  if (!telefono || !mensaje) {
    console.error('⚠️ Parámetros inválidos en guardarMensaje:', { telefono, rol, mensaje });
    return;
  }

  const sql = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  const params = [telefono, rol, mensaje];

  try {
    await pool.execute(sql, params);
    console.log('✅ Mensaje guardado en DB:', params);
  } catch (err) {
    console.error('❌ Error guardando mensaje en DB:', err, '| params:', params);
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
