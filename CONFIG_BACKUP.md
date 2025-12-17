# 🔧 Configuración del Sistema - Turnos NOC

## Variables de Entorno Requeridas

### Backend (Render)
```env
# Firebase Admin SDK (JSON como string)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Gmail (para envío de correos)
GMAIL_USER=tu_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_CHAT_ID=123456789

# Puerto (Render lo asigna automáticamente)
PORT=3000
```

### Frontend (Firebase)
Configurado en `docs/js/firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "asignacionturnos-cc578.firebaseapp.com",
  projectId: "asignacionturnos-cc578",
  storageBucket: "asignacionturnos-cc578.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## URLs Importantes

| Servicio | URL |
|----------|-----|
| **Frontend (Firebase)** | https://asignacionturnos-cc578.web.app |
| **Backend (Render)** | https://turnos-app-8viu.onrender.com |
| **Firebase Console** | https://console.firebase.google.com/project/asignacionturnos-cc578 |
| **Render Dashboard** | https://dashboard.render.com |
| **GitHub Repo** | https://github.com/chech00/TURNOS-APP |

---

## Orígenes CORS Permitidos

```javascript
const ALLOWED_ORIGINS = [
  'https://asignacionturnos-cc578.web.app',
  'https://asignacionturnos-cc578.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://chech00.github.io'
];
```

---

## Cron Jobs Configurados

| Job | Horario | Descripción |
|-----|---------|-------------|
| Asignación de Turnos | Martes 17:15 (PRUEBA) | Asigna turnos automáticamente |
| | Lunes 9:00 (PRODUCCIÓN) | Horario real para producción |

Timezone: `America/Santiago`

---

## Colecciones de Firestore

| Colección | Propósito |
|-----------|-----------|
| `userRoles` | Roles de usuarios (user/admin/superadmin) |
| `userStatus` | Estado de usuarios (suspendido) |
| `calendarios` | Datos del calendario de turnos |
| `empleados` | Lista de empleados |
| `loginLogs` | Logs de inicio de sesión |
| `suralisIncidents` | Incidencias de servicios |
| `documents` | Metadatos de documentos |
| `directorio` | Información del directorio |

---

## Comandos Útiles

```bash
# Desarrollo local
cd backend && npm run dev

# Producción
cd backend && npm start

# Minificar archivos (desde raíz)
npm run minify

# Cambiar a archivos minificados
npm run prod

# Volver a desarrollo
npm run dev
```

---

## Credenciales (NO COMPARTIR)

⚠️ **Las credenciales reales están en:**
- Render: Variables de entorno
- Firebase: Consola de Firebase
- Gmail: App Passwords de Google

---

*Backup de configuración - Diciembre 2024*
