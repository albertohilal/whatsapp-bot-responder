# Integración con Cliente WhatsApp Compartido

**Fecha:** 25 de Diciembre de 2024

## 🎯 Objetivo

Unificar la conexión WhatsApp entre `whatsapp-massive-sender` y `whatsapp-bot-responder` para:
- Evitar doble conexión al mismo número
- Compartir tokens de sesión
- Reducir uso de recursos (memoria, Chrome instances)
- Centralizar la gestión de la conexión

## 📊 Antes y Después

### Antes
```
whatsapp-massive-sender
├── whatsapp-web.js (LocalAuth)
└── tokens/haby/

whatsapp-bot-responder
├── venom-bot
└── tokens/whatsapp-bot-responder/
```
**Problemas:**
- 2 conexiones WhatsApp al mismo número
- 2 instancias de Chrome ejecutándose
- Tokens duplicados en diferentes formatos
- Mayor uso de memoria (~250MB total)

### Después
```
whatsapp-massive-sender
├── whatsapp-web.js (LocalAuth) ← ÚNICA FUENTE DE VERDAD
├── tokens/haby/
└── routes/whatsapp-listener.js ← Sistema de listeners

whatsapp-bot-responder
├── bot/whatsapp-client.js ← Consume API de massive-sender
└── (sin tokens propios)
```
**Beneficios:**
- 1 sola conexión WhatsApp
- 1 instancia de Chrome
- Tokens compartidos
- Menor uso de memoria (~196MB total)

## 🏗️ Arquitectura

### Massive Sender (Puerto 3011)
**Rol:** Proveedor de la conexión WhatsApp

**Nuevos endpoints:**
- `POST /api/whatsapp/register-listener` - Registrar servicios que escuchan mensajes
- `POST /api/whatsapp/unregister-listener` - Desregistrar listeners  
- `POST /api/whatsapp/send` - Enviar mensajes
- `GET /api/whatsapp/status` - Estado de conexión

**Flujo:**
1. Mantiene la conexión WhatsApp activa (routes/haby.js)
2. Escucha eventos `message` del cliente
3. Notifica a todos los listeners registrados vía webhook

### Bot Responder (Puerto 3013)
**Rol:** Consumidor de la conexión compartida

**Nuevo cliente:**
```javascript
// bot/whatsapp-client.js
class SharedWhatsAppClient {
  async initialize() {
    // Registra callback en massive-sender
  }
  
  async sendMessage(to, message) {
    // Envía via API de massive-sender
  }
}
```

**Flujo:**
1. Al iniciar, se registra como listener
2. Recibe mensajes en `POST /api/message-received`
3. Procesa con IA y responde
4. Envía respuestas vía `POST /api/whatsapp/send`

## 📝 Archivos Modificados

### whatsapp-massive-sender
```
routes/
└── whatsapp-listener.js (NUEVO)
    ├── Sistema de registro de listeners
    ├── Notificación de mensajes entrantes
    └── Proxy de envío de mensajes

index.js
└── Agregada ruta app.use(whatsappListenerRoutes)
```

### whatsapp-bot-responder
```
bot/
├── whatsapp-client.js (NUEVO)
│   └── Cliente que consume API de massive-sender
└── whatsapp.js → whatsapp.js.old (RENOMBRADO)

index.js
├── Importa nuevo whatsapp-client
├── Endpoint /api/message-received para webhooks
└── Lógica de procesamiento de mensajes con IA
```

## 🔧 Configuración

### Variables de Entorno

**whatsapp-bot-responder/.env**
```bash
PORT=3013
MASSIVE_SENDER_URL=http://localhost:3011
RESPONDER_CALLBACK_URL=http://localhost:3013/api/message-received

# Database (compartida)
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_DATABASE=iunaorg_dyd
DB_PORT=3306

# OpenAI para respuestas automáticas
OPENAI_API_KEY=sk-proj-...
```

### Nginx

**responder.desarrolloydisenioweb.com.ar**
```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name responder.desarrolloydisenioweb.com.ar;

    location / {
        proxy_pass http://localhost:3013;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    ssl_certificate /etc/letsencrypt/live/responder.desarrolloydisenioweb.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/responder.desarrolloydisenioweb.com.ar/privkey.pem;
}
```

## 🚀 Despliegue

### 1. Reiniciar Massive Sender
```bash
pm2 restart whatsapp-massive-sender
```

### 2. Reiniciar Bot Responder
```bash
pm2 restart whatsapp-bot-responder
```

### 3. Verificar Registro
```bash
# Logs de massive-sender
pm2 logs whatsapp-massive-sender --lines 50

# Deberías ver:
# 📡 Listener registrado: http://localhost:3013/api/message-received

# Logs de bot-responder
pm2 logs whatsapp-bot-responder --lines 50

# Deberías ver:
# ✅ Bot responder registrado como listener en massive-sender
```

### 4. Verificar Estado
```bash
curl http://localhost:3013/api/status
# {
#   "bot": "WhatsApp Bot Responder",
#   "status": "running",
#   "whatsapp": {
#     "connected": true,
#     "state": "CONNECTED",
#     "listeners": 1
#   }
# }
```

## 🧪 Pruebas

### 1. Enviar Mensaje de Prueba
```bash
curl -X POST http://localhost:3011/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5491163083302",
    "message": "Mensaje de prueba desde API compartida"
  }'
```

### 2. Verificar Listeners Activos
```bash
curl http://localhost:3011/api/whatsapp/status
# {
#   "connected": true,
#   "state": "CONNECTED",
#   "listeners": 1
# }
```

### 3. Simular Mensaje Entrante
El massive-sender automáticamente notificará al bot-responder cuando llegue un mensaje real.

## 📊 Recursos PM2

### Antes de la integración
```
whatsapp-massive-sender: 130MB
whatsapp-bot-responder:  120MB (venom-bot + Chrome)
Total:                   250MB
```

### Después de la integración
```
whatsapp-massive-sender: 176MB (incluye listener system)
whatsapp-bot-responder:   20MB (solo Express + lógica IA)
Total:                   196MB
Ahorro:                   54MB (21.6%)
```

## 🔐 Seguridad

### Consideraciones
1. **Endpoints internos:** Los endpoints `/api/whatsapp/*` deberían protegerse con autenticación en producción
2. **Webhooks:** El callback URL solo es accesible desde localhost
3. **Tokens compartidos:** Solo massive-sender tiene acceso directo a los tokens

### Recomendaciones
```javascript
// Agregar middleware de autenticación
router.post('/api/whatsapp/register-listener', requireAuth, (req, res) => {
  // ...
});

// O usar API key
const API_KEY = process.env.WHATSAPP_API_KEY;
router.post('/api/whatsapp/send', (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // ...
});
```

## 🐛 Troubleshooting

### El bot-responder no recibe mensajes
1. Verificar que está registrado:
   ```bash
   curl http://localhost:3011/api/whatsapp/status | grep listeners
   ```

2. Verificar logs de notificación:
   ```bash
   pm2 logs whatsapp-massive-sender | grep "Mensaje recibido"
   ```

3. Reiniciar bot-responder para re-registrarse:
   ```bash
   pm2 restart whatsapp-bot-responder
   ```

### Error "Cliente de WhatsApp no está conectado"
1. Verificar estado de massive-sender:
   ```bash
   curl http://localhost:3011/haby/api/wapp-session/status
   ```

2. Si está desconectado, inicializar:
   ```bash
   curl -X POST http://localhost:3011/haby/api/wapp-session/init
   ```

### Mensajes no se envían
1. Verificar formato del número:
   ```javascript
   // Correcto: "5491163083302@c.us" o "5491163083302"
   // Incorrecto: "+54 911 6308 3302"
   ```

2. Verificar que el cliente esté conectado:
   ```bash
   curl http://localhost:3011/api/whatsapp/status
   ```

## 📚 Referencias

### Flujo de Mensajes Entrantes
```
WhatsApp → massive-sender (whatsapp-web.js)
           ↓
       client.on('message')
           ↓
    whatsapp-listener.js::notifyListeners()
           ↓
    POST http://localhost:3013/api/message-received
           ↓
    bot-responder::procesarMensaje()
           ↓
    Generar respuesta IA
           ↓
    POST http://localhost:3011/api/whatsapp/send
           ↓
    massive-sender → WhatsApp
```

### Flujo de Mensajes Salientes
```
bot-responder::sendMessage()
    ↓
POST http://localhost:3011/api/whatsapp/send
    ↓
massive-sender::getHabyClient()
    ↓
client.sendMessage(phone, text)
    ↓
WhatsApp
```

## ✅ Checklist de Migración

- [x] Crear `routes/whatsapp-listener.js` en massive-sender
- [x] Agregar rutas en `index.js` de massive-sender
- [x] Crear `bot/whatsapp-client.js` en bot-responder
- [x] Modificar `index.js` de bot-responder
- [x] Renombrar `bot/whatsapp.js` a `.old`
- [x] Cambiar puerto a 3013 en bot-responder
- [x] Configurar nginx para responder.desarrolloydisenioweb.com.ar
- [x] Obtener certificado SSL con certbot
- [x] Reiniciar ambos servicios con PM2
- [x] Verificar registro de listener
- [x] Probar envío de mensajes
- [x] Commit y push a GitHub

## 🔮 Próximos Pasos

1. **Agregar más listeners:** Otros servicios pueden registrarse para escuchar mensajes
2. **Panel de administración:** UI para ver listeners activos y su estado
3. **Métricas:** Contadores de mensajes procesados, tasa de respuesta, etc.
4. **Rate limiting:** Limitar requests a los endpoints compartidos
5. **Autenticación:** Proteger endpoints con API keys o JWT
6. **Webhook retry:** Reintentar notificaciones si un listener falla

## 📞 Soporte

- **Logs massive-sender:** `pm2 logs whatsapp-massive-sender`
- **Logs bot-responder:** `pm2 logs whatsapp-bot-responder`
- **Estado servicios:** `pm2 status`
- **Reinicio:** `pm2 restart all`
