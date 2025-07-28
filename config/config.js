require('dotenv').config();
const os = require('os');

const isWindows = os.platform() === 'win32';
const isLocal = process.env.HOST_ENV === 'local'; // ⚠️ Agrega esta variable solo en tu Xubuntu

const venomConfig = {
  session: process.env.SESSION_NAME || 'whatsapp-bot-responder',
  headless: false,
  useChrome: true,
  executablePath: isLocal ? '/usr/bin/google-chrome-stable' : undefined,
  args: isLocal
    ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    : []
};

module.exports = { venomConfig };
