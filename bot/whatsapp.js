// bot/whatsapp.js
const { create } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');
const { normalizarTelefonoWhatsApp, mensajesIguales } = require('../utils/normalizar');

// 🧠 Variables globales de control
const ultimoMensaje = {};
const mensajesLaborales = new Set();

// 💡 Configuración condicional según entorno
const isLocal = process.env.HOST_ENV === 'local';
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
  console.log('🤖 Bot conectado a WhatsApp. Esperando mensajes…');

  client.onMessage(async (message) => {
    const telefonoJid = message.from; // JID completo (ej: 54911...@c.us)
    const telefonoCanon = normalizarTelefonoWhatsApp(telefonoJid);
    const texto = (message.body || '').trim();

    // Filtro duplicados por teléfono:último texto
    if (mensajesIguales(ultimoMensaje[telefonoCanon], texto)) {
      console.log('🔁 Mensaje repetido ignorado');
      return;
    }
    ultimoMensaje[telefonoCanon] = texto;

    // ⛔ Si RESPONDER_ACTIVO=false, solo registramos y salimos
    const responderActivo =
      String(process.env.RESPONDER_ACTIVO || '').toLowerCase() !== 'false' &&
      process.env.RESPONDER_ACTIVO !== '0';

    try {
      // Registrar entrante (user)
      await guardarMensaje(telefonoCanon, 'user', texto);
    } catch (e) {
      // si falla escritura, no cortamos el flujo para que no se caiga el bot
    }

    if (!responderActivo) {
      console.log('🤐 RESPONDER_ACTIVO=false → no se responde');
      return;
    }

    // Historial y generación de respuesta
    let historial = [];
    try {
      historial = await obtenerHistorial(telefonoCanon, 6);
    } catch (e) {
      // no es crítico para responder
    }

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
      respuesta = 'Lo siento, hubo un problema al generar la respuesta.';
    }

    // Enviar y registrar respuesta (assistant)
    try {
      await client.sendText(telefonoJid, respuesta);
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
