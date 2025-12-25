// index.js
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3013;
const whatsappClient = require('./bot/whatsapp-client');
const { generarRespuesta } = require('./ia/chatgpt');
const { guardarMensaje, obtenerHistorial } = require('./db/conversaciones');
const { normalizarTelefonoWhatsApp } = require('./utils/normalizar');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'whatsapp-bot-responder',
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  const clientStatus = await whatsappClient.getStatus();
  
  res.json({ 
    bot: 'WhatsApp Bot Responder',
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    whatsapp: clientStatus
  });
});

// Endpoint para recibir mensajes del massive-sender
app.post('/api/message-received', async (req, res) => {
  const { from, body, timestamp, type, id } = req.body;
  
  console.log(`📨 Mensaje recibido de ${from}: ${body}`);
  
  // Responder inmediatamente al webhook
  res.json({ success: true, received: true });
  
  // Procesar el mensaje de forma asíncrona
  try {
    const telefonoCanon = normalizarTelefonoWhatsApp(from);
    const texto = (body || '').trim();
    
    if (!texto || type !== 'chat') {
      return;
    }
    
    // Guardar mensaje entrante
    await guardarMensaje(telefonoCanon, texto, 'usuario');
    
    // Obtener historial
    const historial = await obtenerHistorial(telefonoCanon, 10);
    
    // Generar respuesta con IA
    const respuestaIA = await generarRespuesta(texto, historial);
    
    if (respuestaIA) {
      // Guardar respuesta del bot
      await guardarMensaje(telefonoCanon, respuestaIA, 'bot');
      
      // Enviar respuesta
      await whatsappClient.sendMessage(from, respuestaIA);
      
      console.log(`✅ Respuesta enviada a ${telefonoCanon}`);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
  }
});

// Start web server
app.listen(port, () => {
  console.log(`🌐 Servidor web escuchando en puerto ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/health`);
  
  // Inicializar cliente WhatsApp compartido
  whatsappClient.initialize();
});

// Cleanup al cerrar
process.on('SIGINT', async () => {
  console.log('🛑 Cerrando bot responder...');
  await whatsappClient.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando bot responder...');
  await whatsappClient.destroy();
  process.exit(0);
});
