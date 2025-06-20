const { create, Client } = require('venom-bot');
const { generarRespuesta } = require('../ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('../db/conversaciones');
const contextoSitio = require('../ia/contextoSitio');
const { venomConfig } = require('../config/config'); // ✅ Ruta corregida

function iniciarBot() {
  create(venomConfig)
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('🤖 Bot conectado a WhatsApp. Esperando mensajes...');

  client.onMessage(async (message) => {
    const telefono = message.from;
    console.log('📩 Mensaje recibido:', message); // ✅ Logging para depurar

    try {
      // Obtener historial anterior
      const historial = await obtenerHistorial(telefono, 6);
      const mensajes = [
        { role: 'system', content: contextoSitio },
        ...historial.map((msg) => ({ role: msg.rol, content: msg.mensaje })),
        { role: 'user', content: message.body }
      ];

      // Generar respuesta con ChatGPT
      const respuesta = await generarRespuesta(mensajes);

      // Guardar mensajes
      await guardarMensaje(telefono, 'user', message.body);
      await guardarMensaje(telefono, 'assistant', respuesta);

      // Enviar respuesta
      await client.sendText(telefono, respuesta);
      console.log('✅ Respuesta enviada a', telefono);
    } catch (error) {
      console.error('❌ Error al generar o enviar respuesta:', error);
      await client.sendText(telefono, 'Lo siento, hubo un problema al generar la respuesta.');
    }
  });
}

module.exports = { iniciarBot };
