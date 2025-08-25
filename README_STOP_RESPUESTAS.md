# 🛑 Procedimiento para detener el bot de respuestas automáticas en Contabo

Este procedimiento permite pausar temporalmente el bot `whatsapp-bot-responder` que responde automáticamente a los mensajes entrantes en WhatsApp, sin eliminar archivos ni modificar el código.

---

## ✅ Requisitos

- Acceso SSH al servidor Contabo.
- Tener PM2 instalado (ya está en uso).
- El proceso `whatsapp-bot-responder` debe estar registrado en PM2.

---

## 🔧 Pasos para detener el bot

1. Conectarse por SSH al servidor:

```bash
ssh root@IP_DEL_SERVIDOR
```

2. Verificar el estado actual de los procesos:

```bash
pm2 list
```

3. Detener el bot ejecutando:

```bash
pm2 stop whatsapp-bot-responder
```

✅ Si preferís usar el ID directamente (por ejemplo, `1`):

```bash
pm2 stop 1
```

4. Verificar que el estado cambió a `stopped`:

```bash
pm2 list
```

---

## 🔁 Para volver a activarlo

Cuando se desee que el bot vuelva a responder automáticamente:

```bash
pm2 start whatsapp-bot-responder
```

---

## 🧘🏼 Comentarios

- El bot queda en estado pausado (`stopped`), no se borra ni pierde su configuración.
- Ideal para hacer pruebas manuales, analizar conversaciones o desactivar temporalmente las respuestas automáticas.
- Mientras esté detenido, otros procesos como `whatsapp-massive-sender` o `crud-bares` siguen funcionando normalmente.
