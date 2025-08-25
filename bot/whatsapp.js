// bot/whatsapp.js
require('dotenv').config();
const { create } = require('venom-bot');

const { generarRespuesta } = require('../ia/chatgpt'); // se llama sólo si RESPONDER_ACTIVO=true
const { guardarMensaje, obtenerHistorial, normalizarTelefonoWhatsApp } = require('../db/conversaciones');
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
  headless: !isLocal,
  useChrome: true,
  executablePath: isLocal ? '/usr/bin/google-chrome-stable' : undefined,
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
  logQR: true,
};

// =========================
// Utilidades
// =========================
const ultimoMensaje = {}; // para evitar loops por duplicados

function logEstado() {
  console.log('========================================');
  console.log('  🤖 whatsapp-bot-responder');
  console.log(`  🧭 HOST_ENV: ${HOST_ENV}`);
  console.log(`  🗂  SESSION_NAME: ${SESSION_NAME}`);
  console.log(`  💬 Responder automático: ${RESPONDER_ACTIVO ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log('========================================');
}

// Extrae un JID usable. Devuelve null si es grupo o evento no registrable.
function extraerTelefono(msg) {
  const candidatos = [
    msg.from,
    msg.chatId,
    msg.sender?.id,
    msg.to,
    msg.contact?.id,
    msg.author, // en grupos/subeventos
  ].filter(Boolean);

  for (const v of candidatos) {
    const s = String(v).trim();
    if (/@g\.us$/i.test(s)) return null; // ignoramos grupos
    if (/@(c\.us|s\.whatsapp\.net)$/i.test(s)) return s;      // JID listo
    if (/^\+?\d{6,}$/.test(s)) return s;                      // sólo dígitos (+/tel)
  }
  return null;
}

function extraerTexto(msg) {
  return (msg.body ?? msg.text ?? msg.caption ?? '').trim();
}

function esMensajeRegistrable(msg) {
  const tipo = msg.type || 'chat';
  const tiposOk = new Set(['chat', 'ptt', 'image', 'video', 'audio', 'document', 'sticker']);
  if (msg.isStatus || msg.isBroadcast) return false;
  if (/@g\.us$/i.test(String(msg.from || ''))) return false; // ignorar grupos
  return tiposOk.has(tipo);
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

  // 1) Mensajes entrantes (de otros hacia vos)
  client.onMessage(async (message) => {
    try {
      // Filtramos eventos que no queremos loguear
      if (!esMensajeRegistrable(message)) return;

      // Extraemos JID y texto
      const jidBruto = extraerTelefono(message);
      if (!jidBruto) return; // sin JID válido, no registramos
      const telefono = normalizarTelefonoWhatsApp(jidBruto);
      if (!telefono) return;

      const texto = extraerTexto(message);
      const rol   = message.fromMe ? 'assistant' : 'user';

      // Guardar SIEMPRE (aunque no respondamos)
      try {
        await guardarMensaje(telefono, rol, texto || null);
      } catch (e) {
        console.error('❌ guardarMensaje falló:', e?.message || e, { telefono, rol, texto });
      }

      // Evitar loops por duplicado exacto (sólo afecta al responder)
      if (ultimoMensaje[telefono] === texto) {
        console.log('🔁 Mensaje repetido ignorado');
        return;
      }
      ultimoMensaje[telefono] = texto;

      // Si responder está off, salimos acá
      if (!RESPONDER_ACTIVO) {
        console.log('🤫 RESPONDER_ACTIVO=false → no se responde');
        return;
      }

      // === Respuesta automática (si activaste RESPONDER_ACTIVO=true) ===
      /*
      const historial = await obtenerHistorial(telefono);
      const analisis  = analizarMensaje(texto);
      const prompt    = contextoSitio({ texto, analisis, historial });
      const reply     = await generarRespuesta({ texto, prompt, telefono });

      if (reply && reply.trim()) {
        await client.sendText(telefono, reply);
        // Registrar saliente
        await guardarMensaje(telefono, 'assistant', reply);
      }
      */
    } catch (e) {
      console.error('❌ Error en onMessage:', e?.message || e);
    }
  });

  // 2) onAnyMessage: captura también mensajes salientes propios
  client.onAnyMessage(async (message) => {
    try {
      if (!esMensajeRegistrable(message)) return;

      const jidBruto = extraerTelefono(message);
      if (!jidBruto) return;
      const telefono = normalizarTelefonoWhatsApp(jidBruto);
      if (!telefono) return;

      const texto = extraerTexto(message);
      const rol   = message.fromMe ? 'assistant' : 'user';

      await guardarMensaje(telefono, rol, texto || null);
    } catch (e) {
      console.error('❌ Error registrando onAnyMessage:', e?.message || e);
    }
  });

  // 3) ACK de entrega/lectura: no guarda texto, así que lo ignoramos para DB simple
  client.onAck(async (_message, _ack) => {
    // Si en el futuro querés guardar ACKs, acá podrías extender el esquema/tabla.
  });
}

iniciarBot();
