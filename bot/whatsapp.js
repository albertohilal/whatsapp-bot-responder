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
    `ENV ⇒ HOST_ENV=${process.env.HOST_ENV || 'server'} | SESSION_NAME=${process.env.SESSION_NAME || 'whatsapp-bot-responder'} | RESPONDER_ACTIVO=${process.env.RESPONDER_ACTIVO ?? '(undef)'}`
  );

  client.onMessage(async (message) => {
    console.log('📥 Mensaje recibido:', message);
    // --- Normalización y saneo ------------------------------------------------
    const telefonoJid = message.from; // ej: 54911xxxxxxxx@c.us
    const telefonoCanon = normalizarTelefonoWhatsApp(telefonoJid);
    const texto = (message.body || '').trim();

    if (!telefonoCanon) {
      console.warn('⚠️ No se pudo normalizar teléfono:', telefonoJid);
      return;
    }
    if (!texto) {
      // ignorar mensajes vacíos/sin texto
      return;
    }

    // --- Anti-duplicados por último texto del contacto ------------------------
    if (mensajesIguales(ultimoMensaje[telefonoCanon], texto)) {
      console.log('🔁 Mensaje repetido ignorado');
      return;
    }
    ultimoMensaje[telefonoCanon] = texto;

    // --- Registrar SIEMPRE el entrante (aunque no respondamos) ----------------
    console.log('Llamando a guardarMensaje:', { telefonoCanon, texto });
    try {
      await guardarMensaje(telefonoCanon, 'user', texto);
    } catch (e) {
      console.error('⚠️ Error guardando entrante:', e.message);
      // No cortamos el flujo.
    }

    // --- Feature flag para responder o no -------------------------------------
    const responderActivo =
      String(process.env.RESPONDER_ACTIVO || '').toLowerCase() !== 'false' &&
      process.env.RESPONDER_ACTIVO !== '0';

    if (!responderActivo) {
      console.log('🤫 RESPONDER_ACTIVO=false → no se responde');
      return; // ya registramos; salimos sin generar respuesta
    }

    // --- Cargar historial (no crítico) ----------------------------------------
    let historial = [];
    try {
      historial = await obtenerHistorial(telefonoCanon, 6);
    } catch {
      /* noop: si falla, seguimos sin historial */
    }

    // --- Generar análisis y respuesta -----------------------------------------
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
      console.error('❌ Error generando respuesta:', e.message);
      respuesta = '';
    }

    // --- Enviar y registrar salida si hay respuesta ---------------------------
    if (respuesta && respuesta.trim()) {
      try {
        await client.sendText(telefonoJid, respuesta);
      } catch (e) {
        console.error('⚠️ Error enviando respuesta a WhatsApp:', e.message);
      }
      try {
        await guardarMensaje(telefonoCanon, 'assistant', respuesta);
      } catch (e) {
        console.error('⚠️ Error guardando respuesta:', e.message);
      }
    }
  });
}

module.exports = { iniciarBot };

if (require.main === module) {
  iniciarBot();
}
