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

// Endpoint para obtener todas las conversaciones
app.get('/api/conversaciones', async (req, res) => {
  try {
    const { obtenerTodasLasConversaciones } = require('./db/conversaciones');
    const conversaciones = await obtenerTodasLasConversaciones();
    res.json(conversaciones);
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error obteniendo conversaciones' });
  }
});

// Endpoint para recibir mensajes del massive-sender
app.post('/api/message-received', async (req, res) => {
  const { from, body, timestamp, type, id, cliente_id } = req.body;
  
  console.log(`📨 Mensaje recibido de ${from}: ${body} (cliente_id: ${cliente_id || 'default'})`);
  
  // Responder inmediatamente al webhook
  res.json({ success: true, received: true });
  
  // Procesar el mensaje de forma asíncrona
  try {
    const telefonoCanon = normalizarTelefonoWhatsApp(from);
    const texto = (body || '').trim();
    
    if (!texto || type !== 'chat') {
      return;
    }
    
    // Usar cliente_id del webhook o fallback al .env
    const clienteIdFinal = cliente_id || process.env.CLIENTE_ID || 51;
    
    // Guardar mensaje entrante con cliente_id
    await guardarMensaje(telefonoCanon, texto, 'usuario', clienteIdFinal);
    
    // Obtener historial del cliente específico
    const historial = await obtenerHistorial(telefonoCanon, 10, clienteIdFinal);
    
    // Generar respuesta con IA
    const respuestaIA = await generarRespuesta(texto, historial);
    
    if (respuestaIA) {
      // Guardar respuesta del bot con cliente_id
      await guardarMensaje(telefonoCanon, respuestaIA, 'bot', clienteIdFinal);
      
      // Enviar respuesta
      await whatsappClient.sendMessage(from, respuestaIA);
      
      console.log(`✅ Respuesta enviada a ${telefonoCanon} (cliente: ${clienteIdFinal})`);
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
