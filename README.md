# whatsapp-bot-responder

Bot de WhatsApp construido con **venom-bot** y **Node.js**, que se integra con **OpenAI** y registra las conversaciones en **MySQL**. Optimizado para correr en **Contabo (Ubuntu)** con **PM2** y para poder **escuchar mensajes sin responder automáticamente** (modo “solo registrar”).

---

## 🚀 Características principales

- Escucha mensajes entrantes y (opcionalmente) responde con IA.
- Registra **tanto entrantes como salientes** en `ll_ia_conversaciones` (MySQL).
- Previene **duplicados** (mismo texto consecutivo por teléfono).
- Modo **solo registrar**: el bot no responde, pero sigue guardando mensajes.
- Configuración **headless** automática en servidor y **no-headless** en local.
- Ejecución persistente con **PM2** (logs, restart, autostart).

---

## 📁 Estructura (resumen)

```
whatsapp-bot-responder/
├─ bot/
│  └─ whatsapp.js          # Lógica del listener y llamadas a guardarMensaje()
├─ db/
│  ├─ connection.js        # Pool MySQL con reintentos (iFastNet)
│  └─ conversaciones.js    # guardarMensaje() / obtenerHistorial()
├─ ia/                     # chatgpt, analizador, respuestas, contexto
├─ utils/
│  └─ normalizar.js        # normaliza el teléfono (ej. agrega dominio @c.us)
├─ index.js                # Punto de entrada (inicia venom con config inline)
├─ .env                    # Variables de entorno (no versionar)
└─ README_STOP_RESPUESTAS.md
```

---

## 🔧 Variables de entorno (`.env`)

```ini
# OpenAI
OPENAI_API_KEY=sk-...

# Base de datos
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_DATABASE=

# Sesión de WhatsApp
SESSION_NAME=whatsapp-bot-responder

# Comportamiento del bot
RESPONDER_ACTIVO=false   # false: no responde; true: responde automáticamente
HOST_ENV=server          # "server" en Contabo, "local" en tu PC
ADMIN_NUMBERS=5491112345678,5491187654321  # (opcional) admins que pueden activar/desactivar por WhatsApp
```

> **Notas**
> - `RESPONDER_ACTIVO=false` deja el listener activo y guardando mensajes sin responder.
> - `HOST_ENV=server` aplica `headless`, `--no-sandbox`, etc. en venom. En local usar `HOST_ENV=local`.
> - `ADMIN_NUMBERS` se usa para habilitar comandos como `"activar respuestas"`, `"desactivar respuestas"` o `"estado respuestas"` enviados desde WhatsApp.

---

## 🛠️ Instalación rápida (local / servidor)

```bash
git clone https://github.com/albertohilal/whatsapp-bot-responder.git
cd whatsapp-bot-responder
npm install
# crea y completa .env (ver bloque anterior)
```

### Lanzar en local

```bash
HOST_ENV=local RESPONDER_ACTIVO=false node index.js
```

### Lanzar en Contabo con PM2

```bash
cd /root/whatsapp-bot-responder
pm2 start index.js --name whatsapp-bot-responder
pm2 save
pm2 logs whatsapp-bot-responder --lines 100
```

> Cada arranque imprime:
> - `Responder automático: ACTIVADO/DESACTIVADO`
> - `Bot conectado a WhatsApp. Escuchando mensajes…`

---

## 🧩 Detalles técnicos clave

### 1) Guardado de mensajes

- `db/conversaciones.js`
  - `guardarMensaje(telefono, rol, mensaje)` → inserta `telefono`, `rol` (`user|assistant`), `mensaje` en `ll_ia_conversaciones`.
  - Normaliza `telefono` (agrega `@c.us` si falta).
  - Usa pool MySQL con **reintentos** ante fallos transitorios (iFastNet).
- `utils/normalizar.js`
  - `normalizarTelefono()` asegura que el número termine en `@c.us`.

### 2) Prevención de duplicados

En `bot/whatsapp.js` se ignoran mensajes con **mismo texto consecutivo por teléfono**:

```js
if (ultimoMensaje[telefono] === texto) {
  console.log('🔁 Mensaje repetido ignorado:', texto);
  return;
}
ultimoMensaje[telefono] = texto;
```

### 3) Listener sin responder

Cuando `RESPONDER_ACTIVO=false`, el flujo **guarda** y **no responde**; ver logs:

```
🙂 RESPONDER_ACTIVO=false → no se responde
```

### 4) Comandos para admins (opcional)

Si defines `ADMIN_NUMBERS`, cualquier número de esa lista puede enviar los comandos:

- `activar respuestas`, `responder on`, `activar bot` → vuelve a habilitar las respuestas automáticas.
- `desactivar respuestas`, `responder off`, `pausar respuestas`, `silenciar bot` → deja el bot solo escuchando.
- `estado respuestas` → reporta el estado actual.

Cada comando responde con una confirmación para que se vea en el chat y queda registrado en la base.

---

## 🔄 Flujo de trabajo (Git)

**Rama de trabajo actual**: `feat/stop-responses-venom-inline`

- Local: confima y sube a GitHub.
- En Contabo: sincroniza sin perder cambios locales accidentales.

```bash
# En Contabo (opcional, backup de por si hay "modified/untracked"):
git stash push -m "backup contabo $(date +%F_%H%M)" --include-untracked

# Asegurar rama y traer cambios
git checkout -B feat/stop-responses-venom-inline origin/feat/stop-responses-venom-inline
git pull --ff-only origin feat/stop-responses-venom-inline

# Reiniciar el proceso con nuevo env (si cambió .env)
pm2 restart whatsapp-bot-responder --update-env
pm2 logs whatsapp-bot-responder --lines 100
```

---

## 🧪 Consultas rápidas a MySQL (debug)

Últimos 20 mensajes de los últimos 30 min (desde Contabo):

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE   -e "SELECT id, telefono, rol, LEFT(mensaje,120) AS msg, created_at
      FROM ll_ia_conversaciones
      WHERE created_at >= NOW() - INTERVAL 30 MINUTE
      ORDER BY id DESC LIMIT 20;"
```

---

## 🧯 Troubleshooting

- **Column 'telefono' cannot be null**  
  Revisa que `guardarMensaje()` reciba `msg.from` real (ej.: `54911...@c.us`). Esto ya está cubierto por `normalizarTelefono()` y los cambios en `bot/whatsapp.js`.

- **Mensajes duplicados**  
  El filtro de repetidos evita consecutivos idénticos por teléfono. Si WhatsApp reintenta, se minimiza el ruido (puede quedar más de 1 si llega desde fuentes distintas).

- **No responde en modo prueba**  
  Confirmá en logs que veas `RESPONDER_ACTIVO=false`. Si querés activar respuestas, poné `RESPONDER_ACTIVO=true` en `.env` y reiniciá con `pm2 restart ... --update-env`.

---

## 📄 Apéndices

- **Guía para pausar respuestas**: ver `README_STOP_RESPUESTAS.md` (procedimiento seguro con PM2).
- **Tablas**: se usa `ll_ia_conversaciones( id, telefono, rol, mensaje, created_at )`.

---

## 📝 Licencia

MIT © 2025 — Alberto Hilal
