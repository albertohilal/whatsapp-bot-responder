const { create } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { venomConfig } = require('../config/config');
const { analizarMensaje } = require('../ia/analizador');
const respuestas = require('../ia/respuestas');

// 🧠 Variables globales de control
const ultimoMensaje = {};
const mensajesLaborales = new Set();

function iniciarBot() {
  create(venomConfig)
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('🤖 Bot conectado a WhatsApp. Esperando mensajes...');

  client.onMessage(async (message) => {
    const telefono = message.from;
    const texto = message.body.trim().toLowerCase();

    // 🧱 Filtro 1: mensaje duplicado
    if (ultimoMensaje[telefono] === texto) {
      console.log('🔁 Mensaje repetido ignorado:', texto);
      return;
    }
    ultimoMensaje[telefono] = texto;

    // 🧱 Filtro 2: mensaje laboral
    const palabrasClaveLaboral = [
      'entrevista', 'trabajo', 'trabajar', 'cv', 'currículum', 'curriculum',
      'postular', 'edad', 'disponibilidad', 'freelance', 'remoto',
      'reclutamiento', 'puesto'
    ];
    if (palabrasClaveLaboral.some(p => texto.includes(p))) {
      if (!mensajesLaborales.has(telefono)) {
        mensajesLaborales.add(telefono);
        await client.sendText(
          telefono,
          'Gracias por tu mensaje. Parece que se trata de una propuesta laboral. Alberto te responderá personalmente a la brevedad.'
        );
        console.log('⚠️ Mensaje laboral detectado. Derivado a humano.');
      } else {
        console.log('📭 Mensaje laboral ya respondido anteriormente.');
      }
      return;
    }

    // 🧠 Analizar intención básica (sin IA)
    const clave = analizarMensaje(texto);
    if (clave) {
      let respuesta;

      // Respuesta agrupada (ej: bienvenida.artista)
      if (clave.includes('.')) {
        const [grupo, tipo] = clave.split('.');
        respuesta = respuestas[grupo]?.[tipo];
      } else {
        respuesta = respuestas[clave];
      }

      if (respuesta) {
        await client.sendText(telefono, respuesta);
        console.log(`💬 Respuesta enviada según analizador: ${clave}`);
        await guardarMensaje(telefono, 'user', message.body);
        await guardarMensaje(telefono, 'assistant', respuesta);
        return;
      }
    }

    // 🤖 Si no hay coincidencia, usar ChatGPT
    try {
      const historial = await obtenerHistorial(telefono, 6);
      const mensajes = [
        { role: 'system', content: contextoSitio },
        ...historial.map((msg) => ({ role: msg.rol, content: msg.mensaje })),
        { role: 'user', content: message.body }
      ];

      const respuesta = await generarRespuesta(mensajes);
      await client.sendText(telefono, respuesta);
      await guardarMensaje(telefono, 'user', message.body);
      await guardarMensaje(telefono, 'assistant', respuesta);
      console.log('✅ Respuesta generada con IA y enviada.');
    } catch (error) {
      console.error('❌ Error al generar o enviar respuesta IA:', error);
      await client.sendText(
        telefono,
        'Lo siento, hubo un problema al generar la respuesta.'
      );
    }
  });
}

module.exports = { iniciarBot };
