// db/conversaciones.js

const pool = require('./pool');
const { normalizarTelefonoWhatsApp } = require('../utils/normalizar');

// Cliente por defecto (Haby)
const DEFAULT_CLIENTE_ID = process.env.CLIENTE_ID || 51;

async function guardarMensaje(telefonoInput, rol, mensaje, clienteId = DEFAULT_CLIENTE_ID) {
  const telefono = normalizarTelefonoWhatsApp(telefonoInput);
  console.log('📝 guardarMensaje params:', { telefonoInput, telefono, rol, mensaje, clienteId });
  // Solo validamos que haya teléfono y mensaje no vacío
  if (!telefono || !mensaje) {
    console.error('⚠️ Parámetros inválidos en guardarMensaje:', { telefono, rol, mensaje });
    return;
  }

  const sql = `
    INSERT INTO ll_ia_conversaciones (cliente_id, telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;
  const params = [clienteId, telefono, rol, mensaje];

  try {
    await pool.execute(sql, params);
    console.log('✅ Mensaje guardado en DB:', params);
  } catch (err) {
    console.error('❌ Error guardando mensaje en DB:', err, '| params:', params);
  }
}


async function obtenerHistorial(telefonoInput, cantidad = 6, clienteId = DEFAULT_CLIENTE_ID) {
  const telefono = normalizarTelefonoWhatsApp(telefonoInput);
  const sql = `
    SELECT rol, mensaje, created_at
    FROM ll_ia_conversaciones
    WHERE cliente_id = ? AND telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const params = [clienteId, telefono, Number(cantidad)];

  try {
    const [rows] = await pool.execute(sql, params);
    return rows || [];
  } catch (err) {
    console.error('❌ Error obteniendo historial:', err.message, '| params:', params);
    throw err;
  }
}

async function obtenerTodasLasConversaciones() {
  const sql = `
    SELECT c.telefono, c.rol, c.mensaje, c.created_at, c.cliente_id, s.nom
    FROM ll_ia_conversaciones c
    LEFT JOIN llxbx_societe s ON REPLACE(c.telefono, '@c.us', '') = s.phone_mobile
    ORDER BY c.created_at DESC
    LIMIT 500
  `;

  try {
    const [rows] = await pool.execute(sql);
    return rows || [];
  } catch (err) {
    console.error('❌ Error obteniendo todas las conversaciones:', err.message);
    throw err;
  }
}

module.exports = {
  guardarMensaje,
  obtenerHistorial,
  obtenerTodasLasConversaciones
};
