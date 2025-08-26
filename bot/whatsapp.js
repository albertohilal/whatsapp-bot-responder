// bot/whatsapp.js

const { create } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');
const { normalizarTelefonoWhatsApp, mensajesIguales } = require('../utils/normalizar');

// ─────────────────────────────────────────────────────────────────────────────
// Estado en memoria para evitar duplicados por contacto
const ultimoMensaje = {};

// Config según entorno
const isLocal = (process.env.HOST_ENV || '').toLowerCase() === 'local';
const venomConfig = {
  session: process.env.SESSION_NAME || 'whatsapp-bot-responder',
  headless: !isLocal,
  useChrome: true,
  executablePath: isLocal ? '/usr/bin/google-chrome-stable' : undefined,
  browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

function iniciarBot() {
  create(venomConfig)
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('🤖 Bot conectado a WhatsApp. Escuchando mensajes…');
  console.log(
    `ENV ⇒ HOST_ENV=${process.env.HOST_ENV || 'server'} | RESPONDER_ACTIVO=${
      process.env.RESPONDER_ACTIVO ?? '(undef)'
    }`
  );

  client.onMessage(async (message) => {
    const telefonoJid = message.from; // ej: 54911xxxxxxxx@c.us
    const telefonoCanon = normalizarTelefonoWhatsApp(telefonoJid);
    const texto = (message.body || '').trim();

    // 1) Filtro anti-duplicados por último texto de ese contacto
    if (mensajesIguales(ultimoMensaje[telefonoCanon], texto)) {
      console.log('🔁 Mensaje repetido ignorado');
      return;
    }
    ultimoMensaje[telefonoCanon] = texto;

    // 2) Registrar SIEMPRE el entrante (aunque no vayamos a responder)
    try {
      await guardarMensaje(telefonoCanon, 'user', texto);
    } catch (e) {
      console.error('⚠️ Error guardando entrante:', e.message);
      // seguimos el flujo igual
    }

    // 3) Control de bandera RESPONDER_ACTIVO
    const responderActivo =
      String(process.env.RESPONDER_ACTIVO || '').toLowerCase() !== 'false' &&
      process.env.RESPONDER_ACTIVO !== '0';

    if (!responderActivo) {
      console.log('🤐 RESPONDER_ACTIVO=false → no se responde');
      return;
    }

    // 4) Historial (no crítico)
    let historial = [];
    try {
      historial = await obtenerHistorial(telefonoCanon, 6);
    } catch {
      /* noop */
    }

    // 5) Generar respuesta
    let respuesta = '';
    try {
      const analisis = analizarMensaje(texto);
      respuesta = await generarRespuesta({
        mensaje: texto,
        historial,
        contextoSitio,
        analisis,
        respuestas,
      });
    } catch (e) {
      console.error('⚠️ Error generando respuesta:', e.message);
      respuesta = 'Ups, tuve un inconveniente generando la respuesta.';
    }

    // 6) Enviar y registrar la salida
    try {
      if (respuesta && respuesta.trim()) {
        await client.sendText(telefonoJid, respuesta);
      }
      await guardarMensaje(telefonoCanon, 'assistant', respuesta);
    } catch (e) {
      console.error('⚠️ Error enviando/registrando respuesta:', e.message);
    }
  });
}

module.exports = { iniciarBot };

if (require.main === module) {
  iniciarBot();
}
