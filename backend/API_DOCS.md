# 📚 Documentación API - Turnos NOC Backend

**Base URL:** `https://turnos-app-8viu.onrender.com`  
**Autenticación:** Bearer Token (Firebase Auth)

---

## 🔐 Autenticación

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer <firebase_id_token>
```

---

## 📧 Email

### POST /send-email
Envía un correo electrónico de notificación.

**Autenticación:** Requerida  
**Rate Limit:** 5 por minuto

**Body:**
```json
{
  "to": "destinatario@email.com",
  "subject": "Asunto del correo",
  "body": "Contenido del correo"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "messageId": "abc123"
}
```

---

## 📱 Telegram

### POST /send-message
Envía un mensaje a Telegram.

**Autenticación:** Requerida  
**Rate Limit:** 10 por minuto

**Body:**
```json
{
  "chatId": "123456789",
  "message": "Texto del mensaje"
}
```

### GET /prueba-telegram
Envía un mensaje de prueba a Telegram.

**Autenticación:** Requerida (Admin)

### GET /webhook-status
Verifica el estado del webhook de Telegram.

---

## 📁 Archivos

### POST /upload
Sube un archivo al servidor.

**Autenticación:** Requerida (Admin)  
**Rate Limit:** 20 por hora  
**Content-Type:** multipart/form-data

**Body:** FormData con campo `file`

**Respuesta exitosa:**
```json
{
  "success": true,
  "url": "https://storage.googleapis.com/..."
}
```

### GET /files
Lista todos los archivos disponibles.

**Autenticación:** Requerida

**Respuesta:**
```json
{
  "files": [
    { "name": "documento.pdf", "url": "https://..." }
  ]
}
```

### DELETE /delete/:fileName
Elimina un archivo.

**Autenticación:** Requerida (Admin)

---

## 📅 Turnos

### POST /trigger-assignment
Dispara la asignación automática de turnos.

**Autenticación:** Requerida (Admin)

### GET /cron-status
Verifica el estado del cron job de asignación.

**Respuesta:**
```json
{
  "cronConfigured": true,
  "schedule": "Martes 17:15 (PRUEBA)",
  "productionSchedule": "Lunes 9:00 AM",
  "timezone": "America/Santiago"
}
```

---

## 🏥 Salud

### GET /health
Verifica que el servidor esté funcionando.

**Autenticación:** No requerida

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-13T10:30:00.000Z"
}
```

### GET /public
Ruta pública de prueba.

**Autenticación:** No requerida

### GET /privado
Ruta privada de prueba.

**Autenticación:** Requerida

---

## ⚠️ Errores Comunes

| Código | Mensaje | Causa |
|--------|---------|-------|
| 401 | Unauthorized | Token inválido o expirado |
| 403 | Origen no permitido | CORS bloqueado |
| 429 | Límite alcanzado | Rate limit excedido |
| 500 | Error interno | Error del servidor |

---

## 🔒 Rate Limits

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| General | 100 | 15 min |
| Upload | 20 | 1 hora |
| Telegram | 10 | 1 min |
| Email | 5 | 1 min |

---

*Documentación generada - Diciembre 2024*
