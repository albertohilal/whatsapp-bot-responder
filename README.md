✅ README.md
markdown
Copiar
Editar
# whatsapp-bot-responder

Bot de WhatsApp desarrollado con [venom-bot](https://github.com/orkestral/venom) y [OpenAI GPT](https://platform.openai.com/), que responde automáticamente a mensajes entrantes utilizando inteligencia artificial.

## 📦 Características

- Escucha mensajes entrantes de clientes o usuarios vía WhatsApp
- Mantiene historial de conversación para respuestas contextualizadas
- Integra OpenAI GPT-4o para generar respuestas inteligentes
- Guarda los mensajes en base de datos MySQL
- Compatible con servidores Linux (probado en Contabo VPS)
- Persistencia con PM2 para ejecución en segundo plano

## 📁 Estructura del proyecto

whatsapp-bot-responder/
├── bot/ # Lógica principal del bot y conexión WhatsApp
├── ia/ # Módulos de integración con OpenAI
├── db/ # Conexión y funciones MySQL
├── config/ # Configuración del entorno
├── .env # Variables de entorno (no incluida en Git)
└── index.js # Punto de entrada del bot

bash
Copiar
Editar

## 🚀 Instalación

```bash
git clone https://github.com/albertohilal/whatsapp-bot-responder.git
cd whatsapp-bot-responder
npm install
Crear un archivo .env con tus claves:

ini
Copiar
Editar
OPENAI_API_KEY=tu-clave-openai
DB_HOST=tu-host
DB_USER=tu-usuario
DB_PASSWORD=tu-clave
DB_DATABASE=tu-base
DB_PORT=3306
SESSION_NAME=whatsapp-bot-responder
▶️ Ejecución
bash
Copiar
Editar
node index.js
# o en producción:
pm2 start index.js --name whatsapp-bot
📄 Licencia
MIT © albertohilal


