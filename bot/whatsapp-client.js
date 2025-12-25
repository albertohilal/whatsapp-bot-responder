// bot/whatsapp-client.js
// Cliente compartido que consume el servicio de whatsapp-massive-sender

const axios = require('axios');

const MASSIVE_SENDER_URL = process.env.MASSIVE_SENDER_URL || 'http://localhost:3011';
const RESPONDER_CALLBACK_URL = process.env.RESPONDER_CALLBACK_URL || 'http://localhost:3013/api/message-received';

class SharedWhatsAppClient {
  constructor() {
    this.registered = false;
  }

  async initialize() {
    try {
      // Registrar este servicio como listener de mensajes
      const response = await axios.post(`${MASSIVE_SENDER_URL}/api/whatsapp/register-listener`, {
        callbackUrl: RESPONDER_CALLBACK_URL
      });

      if (response.data.success) {
        this.registered = true;
        console.log('✅ Bot responder registrado como listener en massive-sender');
        console.log(`📡 Callback URL: ${RESPONDER_CALLBACK_URL}`);
      }
    } catch (error) {
      console.error('❌ Error registrando listener:', error.message);
      // Reintentar en 10 segundos
      setTimeout(() => this.initialize(), 10000);
    }
  }

  async sendMessage(to, message) {
    try {
      const response = await axios.post(`${MASSIVE_SENDER_URL}/api/whatsapp/send`, {
        to,
        message
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error.message);
      throw error;
    }
  }

  async getStatus() {
    try {
      const response = await axios.get(`${MASSIVE_SENDER_URL}/api/whatsapp/status`);
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo estado:', error.message);
      return { connected: false, error: error.message };
    }
  }

  async destroy() {
    if (this.registered) {
      try {
        await axios.post(`${MASSIVE_SENDER_URL}/api/whatsapp/unregister-listener`, {
          callbackUrl: RESPONDER_CALLBACK_URL
        });
        console.log('✅ Listener desregistrado');
      } catch (error) {
        console.error('❌ Error desregistrando listener:', error.message);
      }
    }
  }
}

module.exports = new SharedWhatsAppClient();
