require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'iunaorg_dyd',
  port: process.env.DB_PORT || 3306,
};

async function guardarMensaje(telefono, rol, mensaje) {
  const connection = await mysql.createConnection(dbConfig);
  const query = `
    INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  await connection.execute(query, [telefono, rol, mensaje]);
  await connection.end();
}

async function obtenerHistorial(telefono, cantidad = 6) {
  const connection = await mysql.createConnection(dbConfig);
  const query = `
    SELECT rol, mensaje
    FROM ll_ia_conversaciones
    WHERE telefono = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const [rows] = await connection.execute(query, [telefono, cantidad]);
  await connection.end();

  return rows.reverse();
}

module.exports = { guardarMensaje, obtenerHistorial };
