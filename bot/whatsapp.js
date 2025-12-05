// bot/whatsapp.js

const { create } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');
const { normalizarTelefonoWhatsApp, mensajesIguales } = require('../utils/normalizar');

const responderDefault = parseBoolean(process.env.RESPONDER_ACTIVO, true);
let responderOverride = null;

const adminNumbers = buildAdminSet(process.env.ADMIN_NUMBERS || '');

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
    `ENV ⇒ HOST_ENV=${process.env.HOST_ENV || 'server'} | SESSION_NAME=${process.env.SESSION_NAME || 'whatsapp-bot-responder'} | RESPONDER_ACTIVO=${process.env.RESPONDER_ACTIVO ?? '(undef)'} | ADMIN_NUMBERS=${process.env.ADMIN_NUMBERS || '(none)'}`
  );
  console.log(`🤖 Respuestas automáticas ${responderDefault ? 'ACTIVADAS' : 'PAUSADAS'} (override: ${responderOverride ?? 'none'})`);

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
    }

    // --- Comandos administrativos para activar/desactivar respuestas ---------
    const comandoGestionado = await manejarComandoAdmin({
      telefonoCanon,
      telefonoJid,
      texto,
      client,
    });
    if (comandoGestionado) {
      return; // ya se respondió con un comando administrativo
    }

    // --- Feature flag para responder o no -------------------------------------
    const responderActivo = obtenerEstadoResponder();

    if (!responderActivo) {
      console.log('🤫 Respuesta automática desactivada → solo se registra el mensaje');
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

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  if (['true', '1', 'on', 'si', 'sí', 'yes'].includes(normalized)) return true;
  return defaultValue;
}

function buildAdminSet(raw) {
  const set = new Set();
  raw
    .split(',')
    .map((v) => normalizarTelefonoWhatsApp(v))
    .filter(Boolean)
    .forEach((telefono) => {
      set.add(telefono);
      set.add(telefono.replace(/@c\.us$/i, ''));
    });
  return set;
}

function esAdmin(telefonoCanon) {
  if (!adminNumbers.size) return false;
  const canon = normalizarTelefonoWhatsApp(telefonoCanon);
  if (!canon) return false;
  const sinSufijo = canon.replace(/@c\.us$/i, '');
  return adminNumbers.has(canon) || adminNumbers.has(sinSufijo);
}

function obtenerEstadoResponder() {
  if (typeof responderOverride === 'boolean') {
    return responderOverride;
  }
  return responderDefault;
}

async function manejarComandoAdmin({ telefonoCanon, telefonoJid, texto, client }) {
  if (!esAdmin(telefonoCanon)) return false;
  const comando = texto.trim().toLowerCase();
  const activar = [
    'activar respuestas',
    'responder on',
    'activar bot',
    'encender respuestas',
  ];
  const desactivar = [
    'desactivar respuestas',
    'responder off',
    'pausar respuestas',
    'silenciar bot',
  ];
  const estado = ['estado respuestas', 'status respuestas', 'estado bot'];

  if (activar.includes(comando)) {
    responderOverride = true;
    console.log('⚙️ Respuestas automáticas ACTIVADAS vía comando admin');
    await responderModo(client, telefonoJid, telefonoCanon, true);
    return true;
  }
  if (desactivar.includes(comando)) {
    responderOverride = false;
    console.log('⚙️ Respuestas automáticas PAUSADAS vía comando admin');
    await responderModo(client, telefonoJid, telefonoCanon, false);
    return true;
  }
  if (estado.includes(comando)) {
    const activo = obtenerEstadoResponder();
    await responderModo(client, telefonoJid, telefonoCanon, activo, true);
    return true;
  }
  return false;
}

async function responderModo(client, telefonoJid, telefonoCanon, activo, soloEstado = false) {
  const mensaje = soloEstado
    ? `🤖 Respuesta automática actualmente ${activo ? 'ACTIVA' : 'PAUSADA'}`
    : `🤖 Respuesta automática ${activo ? 'ACTIVADA' : 'PAUSADA'}`;
  try {
    await client.sendText(telefonoJid, mensaje);
  } catch (err) {
    console.error('⚠️ No se pudo enviar confirmación de modo al admin:', err.message);
  }

  try {
    await guardarMensaje(telefonoCanon, 'assistant', mensaje);
  } catch (err) {
    console.error('⚠️ No se pudo registrar confirmación de modo:', err.message);
  }
}
