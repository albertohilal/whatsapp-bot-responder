// bot/whatsapp.js
require('dotenv').config();
const { create } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt'); // seguirá sin usarse si RESPONDER_ACTIVO=false
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');

// =========================
// Flags de entorno
// =========================
const RESPONDER_ACTIVO = String(process.env.RESPONDER_ACTIVO || 'false').toLowerCase() === 'true';
const HOST_ENV = (process.env.HOST_ENV || 'server').toLowerCase(); // 'local' | 'server'
const SESSION_NAME = process.env.SESSION_NAME || 'whatsapp-bot-responder';

// =========================
// Configuración de Venom
// =========================
const isLocal = HOST_ENV === 'local';
const venomConfig = {
  session: SESSION_NAME,
  headless: !isLocal,            // En server: headless
  useChrome: true,
  executablePath: isLocal ? '/usr/bin/google-chrome-stable' : undefined,
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ],
  logQR: true,
};

// =========================
// Utilidades
// =========================
const ultimoMensaje = {};
const mensajesLaborales = new Set();

function logEstado() {
  console.log('========================================');
  console.log('  🤖 whatsapp-bot-responder');
  console.log(`  🧭 HOST_ENV: ${HOST_ENV}`);
  console.log(`  🗂  SESSION_NAME: ${SESSION_NAME}`);
  console.log(`  💬 Responder automático: ${RESPONDER_ACTIVO ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log('========================================');
}

async function registrar(message) {
  try {
    const base = {
      id: message.id?._serialized || '',
      from: message.from || '',
      to: message.to || '',
      body: message.body || '',
      type: message.type || 'chat',
      timestamp: Number(message.timestamp || Math.floor(Date.now() / 1000)),
      fromMe: !!message.fromMe,
      ack: typeof message.ack === 'number' ? message.ack : null,
      raw: {
        from: message.from,
        to: message.to,
        type: message.type,
        fromMe: message.fromMe,
        timestamp: message.timestamp,
        deviceType: message.deviceType,
        author: message.author || null, // grupos
      }
    };

    // Si ya usás guardarMensaje(custom), adaptá aquí el mapeo:
    await guardarMensaje({
      wa_msg_id: base.id,
      chat_id: base.from || base.to,
      de_numero: base.from,
      a_numero: base.to,
      cuerpo: base.body,
      tipo: base.type,
      timestamp: base.timestamp,
      de_mi: base.fromMe ? 1 : 0,
      ack: base.ack,
      raw_json: base.raw
    });
  } catch (e) {
    console.error('❌ Error guardando mensaje:', e?.message || e);
  }
}

// =========================
// Arranque del bot
// =========================
function iniciarBot() {
  logEstado();
  create(venomConfig)
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('✅ Bot conectado a WhatsApp. Escuchando mensajes…');

  // Entrantes (de otros hacia vos)
  client.onMessage(async (message) => {
    try {
      await registrar(message);

      // Filtros básicos (opcional)
      const telefono = message.from;
      const texto = (message.body || '').trim();

      // Evitar loops por duplicado exacto
      if (ultimoMensaje[telefono] === texto) {
        console.log('🔁 Mensaje repetido ignorado');
        return;
      }
      ultimoMensaje[telefono] = texto;

      // Si el responder está desactivado, no respondas:
      if (!RESPONDER_ACTIVO) {
        console.log('🤫 RESPONDER_ACTIVO=false → no se responde');
        return;
      }

      // --- Respuesta automática (solo si está activo) ---
      // (Dejamos ejemplo por si querés reactivarlo)
      /*
      const historial = await obtenerHistorial(telefono);
      const analisis = analizarMensaje(texto);
      const prompt = contextoSitio({ texto, analisis, historial });

      const reply = await generarRespuesta({ texto, prompt, telefono });
      if (reply && reply.trim()) {
        await client.sendText(telefono, reply);
      }
      */
    } catch (e) {
      console.error('❌ Error en onMessage:', e?.message || e);
    }
  });

  // Mensajes creados por vos (salientes)
  client.onAnyMessage(async (message) => {
    // Venom: onAnyMessage te permite capturar también lo que enviás
    try {
      await registrar(message);
    } catch (e) {
      console.error('❌ Error registrando saliente:', e?.message || e);
    }
  });

  // Estado de entrega/lectura (ACK)
  client.onAck(async (message, ack) => {
    try {
      await registrar({ ...message, ack });
    } catch (e) {
      console.error('❌ Error actualizando ACK:', e?.message || e);
    }
  });
}

iniciarBot();
