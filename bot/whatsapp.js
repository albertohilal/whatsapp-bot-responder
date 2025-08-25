// bot/whatsapp.js
require('dotenv').config();
const { create } = require('venom-bot');

// Se usa solo si RESPONDER_ACTIVO=true (por defecto NO respondemos)
const { generarRespuesta } = require('../ia/chatgpt');
const {
  guardarMensaje,
  obtenerHistorial,
  normalizarTelefonoWhatsApp,
} = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');

// =========================
// Flags de entorno
// =========================
const RESPONDER_ACTIVO = String(process.env.RESPONDER_ACTIVO || 'false')
  .toLowerCase() === 'true';
const HOST_ENV = (process.env.HOST_ENV || 'server').toLowerCase(); // 'local' | 'server'
const SESSION_NAME = process.env.SESSION_NAME || 'whatsapp-bot-responder';

// =========================
// Configuración de Venom
// =========================
const isLocal = HOST_ENV === 'local';
const venomConfig = {
  session: SESSION_NAME,
  headless: !isLocal, // en Contabo headless
  useChrome: true,
  executablePath: isLocal ? '/usr/bin/google-chrome-stable' : undefined,
  browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  logQR: true,
};

// =========================
// Utilidades
// =========================
const ultimoMensaje = {}; // evita responder dos veces el mismo texto
const vistos = new Set(); // dedupe por id en 1 minuto

function yaVisto(id) {
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.add(id);
  setTimeout(() => vistos.delete(id), 60_000); // 1 minuto
  return false;
}

function logEstado() {
  console.log('========================================');
  console.log('  🤖 whatsapp-bot-responder');
  console.log(`  🧭 HOST_ENV: ${HOST_ENV}`);
  console.log(`  🗂  SESSION_NAME: ${SESSION_NAME}`);
  console.log(`  💬 Responder automático: ${RESPONDER_ACTIVO ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log('========================================');
}

// Extrae un JID usable. Devuelve null si es grupo o no se detecta.
function extraerTelefono(msg) {
  const candidatos = [
    msg.from,
    msg.chatId,
    msg.sender?.id,
    msg.to,
    msg.contact?.id,
    msg.author, // en grupos / eventos
  ].filter(Boolean);

  for (const v of candidatos) {
    const s = String(v).trim();
    if (/@g\.us$/i.test(s)) return null; // ignoramos grupos
    if (/@(c\.us|s\.whatsapp\.net)$/i.test(s)) return s; // JID listo
    if (/^\+?\d{6,}$/.test(s)) return s; // solo dígitos (+/tel)
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
function iniciarBot() {
  logEstado();
  create(venomConfig)
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('✅ Bot conectado a WhatsApp. Escuchando mensajes…');

  // 1) Entrantes
  client.onMessage(async (message) => {
    try {
      if (!esMensajeRegistrable(message)) return;

      const idMsg = message.id?._serialized || '';
      if (yaVisto(idMsg)) return; // dedupe por id

      const jidBruto = extraerTelefono(message);
      if (!jidBruto) return; // sin JID válido, no registramos

      const telefono = normalizarTelefonoWhatsApp(jidBruto);
      if (!telefono) return;

      const texto = extraerTexto(message);
      const rol = message.fromMe ? 'assistant' : 'user';

      // Guardar SIEMPRE (aunque no respondamos)
      try {
        await guardarMensaje(telefono, rol, texto || null);
      } catch (e) {
        console.error('❌ guardarMensaje falló:', e?.message || e, { telefono, rol, texto });
      }

      // Evitar responder 2 veces al mismo texto
      if (ultimoMensaje[telefono] === texto) {
        console.log('🔁 Mensaje repetido ignorado');
        return;
      }
      ultimoMensaje[telefono] = texto;

      if (!RESPONDER_ACTIVO) {
        console.log('🤫 RESPONDER_ACTIVO=false → no se responde');
        return;
      }

      // ===== Respuesta automática (opcional) =====
      /*
      const historial = await obtenerHistorial(telefono);
      const analisis  = analizarMensaje(texto);
      const prompt    = contextoSitio({ texto, analisis, historial });
      const reply     = await generarRespuesta({ texto, prompt, telefono });

      if (reply && reply.trim()) {
        await client.sendText(telefono, reply);
        await guardarMensaje(telefono, 'assistant', reply);
      }
      */
    } catch (e) {
      console.error('❌ Error en onMessage:', e?.message || e);
    }
  });

  // 2) Salientes tuyos (solo registramos; NO respondemos acá)
  client.onAnyMessage(async (message) => {
    try {
      if (!message.fromMe) return;           // evitar duplicar entrantes
      if (!esMensajeRegistrable(message)) return;

      const idMsg = message.id?._serialized || '';
      if (yaVisto(idMsg)) return;

      const jidBruto = extraerTelefono(message);
      if (!jidBruto) return;

      const telefono = normalizarTelefonoWhatsApp(jidBruto);
      if (!telefono) return;

      const texto = extraerTexto(message);
      await guardarMensaje(telefono, 'assistant', texto || null);
    } catch (e) {
      console.error('❌ Error registrando saliente:', e?.message || e);
    }
  });

  // 3) ACK de entrega/lectura → no guardamos (evita tercer duplicado)
  client.onAck(async (_message, _ack) => {
    // Si en el futuro querés guardar ACKs, habrá que persistir wa_msg_id y hacer UPDATE.
  });
}

iniciarBot();
