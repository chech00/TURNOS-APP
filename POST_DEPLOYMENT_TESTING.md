# ✅ Checklist de Verificación Post-Despliegue

## 📋 Antes de Desplegar
- [ ] Backup actual de reglas de Firestore (por si acaso)
- [ ] Tener abierta la Firebase Console

## 🚀 Despliegue de Reglas

### Opción 1: Firebase Console (RECOMENDADO para primera vez)

1. **Abre Firebase Console**
   ```
   https://console.firebase.google.com/
   ```

2. **Selecciona tu proyecto:**
   - `asignacionturnos-cc578`

3. **Ve a Firestore Database → Reglas**

4. **IMPORTANTE: Guarda backup de reglas actuales**
   - Copia las reglas actuales a un archivo temporal
   - Así puedes revertir si algo falla

5. **Pega las nuevas reglas:**
   - Abre: `C:\Users\Sergio\Desktop\TURNOS-APP-main\firestore.rules`
   - Selecciona TODO (Ctrl+A)
   - Copia (Ctrl+C)
   - Pega en el editor de Firebase Console
   - Click "Publicar"

---

## 🧪 Testing Post-Despliegue

### Test 1: Login como SuperAdmin ✅
- [ ] Ingresar con cuenta superadmin
- [ ] Ver que carga la vista `index.html`
- [ ] Ver todos los menús (incluido "Registros")
- [ ] **Intentar crear/editar un calendario**
- [ ] **Intentar agregar un turno**

**✅ Si todo funciona → Continuar**
**❌ Si falla → Revisar consola del navegador (F12)**

---

### Test 2: Login como Admin ✅
- [ ] Ingresar con cuenta admin
- [ ] Ver que carga la vista `index.html`
- [ ] Ver menús de admin (sin "Registros")
- [ ] **Intentar crear/editar un calendario**
- [ ] **Intentar modificar turnos**

**✅ Si todo funciona → Continuar**
**❌ Si falla → Revisar consola del navegador (F12)**

---

### Test 3: Login como Usuario Normal ✅
- [ ] Ingresar con cuenta de usuario
- [ ] Ver que carga la vista `user.html`
- [ ] **NO** debe ver botones de admin
- [ ] Puede VER el calendario
- [ ] **NO puede modificar** nada

**✅ Si todo funciona → Continuar**
**❌ Si falla → Revisar consola del navegador (F12)**

---

### Test 4: Intentar Bypass (Seguridad) 🔒
- [ ] Login como usuario normal
- [ ] Abrir consola del navegador (F12)
- [ ] Ejecutar:
   ```javascript
   localStorage.setItem('userRole', 'superadmin');
   location.reload();
   ```
- [ ] **Verificar:** Aún debe estar en `user.html`
- [ ] **Verificar:** NO debe poder modificar calendarios

**✅ Si NO puede hacer bypass → EXCELENTE**
**❌ Si puede hacer bypass → Las reglas no están activas**

---

## 🚨 Si Algo Falla

### Error: "Missing or insufficient permissions"
**Causa:** Las reglas están funcionando correctamente, pero algo en el código cliente necesita ajuste.

**Solución:**
1. Abre DevTools (F12) → Consola
2. Copia el error completo
3. Mándamelo para que lo arregle

### Error: "PERMISSION_DENIED"
**Causa:** El usuario no tiene el rol esperado o las reglas están muy restrictivas.

**Solución:**
1. Verifica en Firestore Console → `userRoles` collection
2. Confirma que tu usuario tiene `rol: "admin"` o `"superadmin"`

### La app no carga nada
**Causa:** Posible error de sintaxis en las reglas.

**Solución:**
1. Revierte a las reglas anteriores (el backup que hiciste)
2. Avísame y revisamos el error

---

## 📞 Después del Testing

**Si TODO está funcionando:**
✅ Me confirmas y continuamos con la refactorización de código (eliminar XSS)

**Si ALGO falla:**
❌ Me mandas el error de la consola y lo arreglamos antes de continuar

---

## 💡 Tip de Debugging

Mantén abierta la pestaña "Consola" de DevTools (F12) mientras pruebas.
Cualquier error de permisos aparecerá ahí con detalles específicos.
