# 📘 Instrucciones de Despliegue Manual - Firebase

## ⚠️ IMPORTANTE
El Firebase CLI no está instalado en tu sistema. Sigue estos pasos para desplegar las reglas de seguridad.

## Opción 1: Desplegar desde Firebase Console (MÁS FÁCIL)

### Paso 1: Abrir Firebase Console
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto: **asignacionturnos-cc578**
3. En el menú lateral, ve a **Firestore Database**

### Paso 2: Desplegar Reglas de Firestore
1. Click en la pestaña "**Reglas**" (Rules)
2. **Copia TODO el contenido** del archivo `firestore.rules`
3. **Pégalo** en el editor de la consola (reemplaza todo lo que esté ahí)
4. Click en "**Publicar**" (Publish)

✅ **Listo!** Las reglas están activas.

---

## Opción 2: Instalar Firebase CLI y Desplegar (Recomendado para futuro)

### Paso 1: Instalar Firebase CLI

node.jsAbre PowerShell como Administrador y ejecuta:

```powershell
npm install -g firebase-tools
```

### Paso 2: Iniciar Sesión
```powershell
firebase login
```

### Paso 3: Inicializar Proyecto (Solo primera vez)
```powershell
cd "C:\Users\Sergio\Desktop\TURNOS-APP-main"
firebase init
```

Selecciona:
- ✅ Firestore
- ✅ Hosting
- Usa el proyecto existente: **asignacionturnos-cc578**

### Paso 4: Desplegar Reglas
```powershell
firebase deploy --only firestore:rules
```

### Paso 5: Desplegar Headers de Seguridad
```powershell
firebase deploy --only hosting
```

---

## Verificación

### Verificar Reglas de Firestore
1. Ve a Firebase Console → Firestore Database → Reglas
2. Deberías ver las nuevas reglas con funciones como `isAdmin()`, `isSuperAdmin()`, etc.
3. Verifica la fecha de "Última publicación"

### Verificar Headers de Seguridad
1. Despliega tu sitio con `firebase deploy --only hosting`
2. Abre tu sitio web
3. Abre DevTools (F12) → Red (Network)
4. Recarga la página
5. Click en el archivo HTML principal
6. En "Headers" busca **Content-Security-Policy**
7. Debes ver: `default-src 'self'; script-src...`

---

## 🚨 Solución de Problemas

### Error: "Permission denied"
- Asegúrate de estar en el proyecto correcto
- Verifica que tu usuario tenga permisos de Editor o Propietario en Firebase

### Error: "Syntax error in rules"
- Verifica que copiaste TODO el contenido de `firestore.rules`
- Asegúrate de no tener caracteres extra al copiar/pegar

### No puedes instalar Firebase CLI
- **Alternativa:** Usa solo la Firebase Console (Opción 1)
- Las reglas se pueden editar completamente desde la web

---

## 📝 Checklist de Despliegue

- [ ] Reglas de Firestore desplegadas
- [ ] Headers de seguridad configurados (firebase.json)
- [ ] Hosting desplegado (si aplicable)
- [ ] Verificado que las reglas funcionan
- [ ] Probado acceso con usuario normal
- [ ] Probado acceso con admin

---

**Próximo Paso:** Una vez desplegadas las reglas, procederemos a refactorizar el código JavaScript para eliminar vulnerabilidades XSS.
