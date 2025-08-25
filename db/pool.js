// db/pool.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,              // ej: sv46.byethost46.org
  user: process.env.DB_USER,              // ej: iunaorg_b3toh
  password: process.env.DB_PASSWORD,      // ej: elgeneral2018
  database: process.env.DB_DATABASE,      // ej: iunaorg_dyd
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 3,                     // ⭐ pequeño para iFastNet
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4'
});

module.exports = pool;
