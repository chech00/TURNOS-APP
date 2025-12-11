const { admin, db } = require("../config/firebase");
const { enviarMensajeConBotones, enviarMensajeTelegramDirecto } = require("../services/telegramService");

/**
 * Función principal que asigna turnos automáticamente
 * @param {boolean} isManualTrigger - Si es true, no verifica día/hora
 */
async function asignarTurnosAutomaticos(isManualTrigger = false) {
    console.log("🔄 Iniciando asignación automática de turnos...");

    try {
        // 1. Cargar empleados desde la colección "Empleados"
        const empleadosSnapshot = await db.collection("Empleados").get();

        if (empleadosSnapshot.empty) {
            console.error("❌ No se encontraron empleados en Firestore");
            return { success: false, error: "No se encontraron empleados" };
        }

        // 2. Separar empleados por rol
        const tecnicosRed = [];
        const ingenieros = [];
        const plantaExterna = [];

        empleadosSnapshot.forEach(doc => {
            const data = doc.data();
            const nombre = data.nombre || doc.id;
            const rol = data.rol || "";

            // Mapear roles según los valores en Firestore
            if (rol.toLowerCase().includes("tecnico") || rol.toLowerCase().includes("técnico")) {
                tecnicosRed.push(nombre);
            } else if (rol.toLowerCase().includes("ingeniero")) {
                ingenieros.push(nombre);
            } else if (rol.toLowerCase().includes("planta")) {
                plantaExterna.push(nombre);
            }
        });

        console.log(`📊 Empleados cargados: ${tecnicosRed.length} técnicos, ${ingenieros.length} ingenieros, ${plantaExterna.length} planta`);
        console.log(`   Técnicos: ${tecnicosRed.join(', ')}`);
        console.log(`   Ingenieros: ${ingenieros.join(', ')}`);
        console.log(`   Planta: ${plantaExterna.join(', ')}`);

        if (tecnicosRed.length === 0 || ingenieros.length === 0 || plantaExterna.length === 0) {
            console.error("❌ Faltan empleados en alguna categoría");
            return { success: false, error: `Faltan empleados. Técnicos: ${tecnicosRed.length}, Ingenieros: ${ingenieros.length}, Planta: ${plantaExterna.length}` };
        }

        // 3. Calcular semana actual del mes
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = hoy.getMonth();
        const primerDiaDelMes = new Date(año, mes, 1);
        const diaSemanaPrimerDia = primerDiaDelMes.getDay() === 0 ? 7 : primerDiaDelMes.getDay();
        const diaDelMes = hoy.getDate();
        const semanaIndex = Math.floor((diaDelMes + diaSemanaPrimerDia - 2) / 7);

        console.log(`📅 Año: ${año}, Mes: ${mes}, Semana: ${semanaIndex + 1}`);

        // 4. Verificar si ya existe asignación para esta semana
        const docId = `${año}-${mes}-${semanaIndex + 1}`;
        const existingDoc = await db.collection("AsignacionesSemanales").doc(docId).get();

        if (existingDoc.exists && !isManualTrigger) {
            console.log(`⚠️ Ya existe asignación para semana ${semanaIndex + 1}. Saltando.`);
            return { success: false, error: "Ya existe asignación para esta semana" };
        }

        // 5. Calcular la rotación (usando semanaIndex como offset)
        const tecnico = tecnicosRed[semanaIndex % tecnicosRed.length];
        const ingeniero = ingenieros[semanaIndex % ingenieros.length];
        const planta = plantaExterna[semanaIndex % plantaExterna.length];

        console.log(`👥 Asignación: Técnico=${tecnico}, Ingeniero=${ingeniero}, Planta=${planta}`);

        // 6. Calcular fechas de la semana
        const inicioSemana = new Date(año, mes, diaDelMes - hoy.getDay() + 1); // Lunes
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(finSemana.getDate() + 6); // Domingo

        const formatFecha = (d) => {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        // Preparar datos de la semana para el flujo de confirmación
        const datosSemana = {
            semana: semanaIndex + 1,
            año,
            mes,
            fechaInicio: formatFecha(inicioSemana),
            fechaFin: formatFecha(finSemana)
        };

        // Cargar chat IDs de empleados
        const chatIds = {};
        empleadosSnapshot.forEach(doc => {
            const data = doc.data();
            const nombre = data.nombre || doc.id;
            if (data.telegramChatId) {
                chatIds[nombre] = data.telegramChatId;
            }
        });

        // 7. INICIAR FLUJO DE CONFIRMACIÓN INTERACTIVA
        // En lugar de asignar directamente, preguntamos a cada empleado
        console.log("📱 Iniciando flujo de confirmación interactiva...");

        const resultados = {
            tecnico: null,
            ingeniero: null,
            planta: null
        };

        // Iniciar confirmación para cada rol
        resultados.tecnico = await iniciarConfirmacionRol(
            "tecnico",
            tecnicosRed,
            chatIds,
            datosSemana,
            { tecnicosRed, ingenieros, plantaExterna }
        );

        resultados.ingeniero = await iniciarConfirmacionRol(
            "ingeniero",
            ingenieros,
            chatIds,
            datosSemana,
            { tecnicosRed, ingenieros, plantaExterna }
        );

        resultados.planta = await iniciarConfirmacionRol(
            "planta",
            plantaExterna,
            chatIds,
            datosSemana,
            { tecnicosRed, ingenieros, plantaExterna }
        );

        console.log("✅ Mensajes de confirmación enviados. Esperando respuestas...");
        console.log(`   Técnico: ${resultados.tecnico?.empleado || 'Sin candidato'}`);
        console.log(`   Ingeniero: ${resultados.ingeniero?.empleado || 'Sin candidato'}`);
        console.log(`   Planta: ${resultados.planta?.empleado || 'Sin candidato'}`);

        return {
            success: true,
            mensaje: "Flujo de confirmación iniciado. Esperando respuestas de los empleados.",
            pendientes: {
                tecnico: resultados.tecnico?.empleado,
                ingeniero: resultados.ingeniero?.empleado,
                planta: resultados.planta?.empleado
            }
        };

    } catch (error) {
        console.error("❌ Error en asignación automática:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Inicia el flujo de confirmación para un rol específico
 */
async function iniciarConfirmacionRol(rol, candidatos, chatIds, datosSemana, empleadosData) {
    if (!candidatos || candidatos.length === 0) {
        console.error(`❌ No hay candidatos para el rol: ${rol}`);
        return null;
    }

    const primerCandidato = candidatos[0];
    const chatId = chatIds[primerCandidato];

    if (!chatId) {
        console.log(`⚠️ ${primerCandidato} no tiene telegramChatId, pasando al siguiente...`);
        // Intentar con el siguiente
        if (candidatos.length > 1) {
            return await iniciarConfirmacionRol(rol, candidatos.slice(1), chatIds, datosSemana, empleadosData);
        }
        return null;
    }

    // Crear documento de asignación pendiente
    const pendienteId = `${datosSemana.año}-${datosSemana.mes}-${datosSemana.semana}-${rol}`;

    await db.collection("AsignacionesPendientes").doc(pendienteId).set({
        rol: rol,
        empleadoActual: primerCandidato,
        empleadosRestantes: candidatos.slice(1),
        chatIdActual: chatId,
        datosSemana: datosSemana,
        fechaEnvio: new Date().toISOString(),
        estado: "pendiente",
        todosLosEmpleados: empleadosData // Para fallback
    });

    // Enviar mensaje con botones
    const mensaje = `📅 *Asignación de Turno Semanal*\n\n` +
        `Hola *${primerCandidato}*, te corresponde el turno como *${rol}*:\n\n` +
        `📆 Semana ${datosSemana.semana}\n` +
        `📅 ${datosSemana.fechaInicio} - ${datosSemana.fechaFin}\n\n` +
        `¿Puedes tomar este turno?`;

    const messageId = await enviarMensajeConBotones(chatId, mensaje, pendienteId);

    if (messageId) {
        await db.collection("AsignacionesPendientes").doc(pendienteId).update({
            messageId: messageId
        });
    }

    return { pendienteId, empleado: primerCandidato };
}

/**
 * Procesa la confirmación de un turno
 */
async function procesarConfirmacion(pendienteId, chatId) {
    try {
        const docRef = db.collection("AsignacionesPendientes").doc(pendienteId);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.error(`❌ No se encontró asignación pendiente: ${pendienteId}`);
            return { success: false, message: "Asignación no encontrada" };
        }

        const data = doc.data();

        if (data.estado !== "pendiente") {
            return { success: false, message: "Esta asignación ya fue procesada" };
        }

        // Marcar como confirmado
        await docRef.update({
            estado: "confirmado",
            fechaConfirmacion: new Date().toISOString()
        });

        // Guardar en AsignacionesSemanales si todos los roles están confirmados
        await verificarYGuardarAsignacionCompleta(data.datosSemana);

        console.log(`✅ ${data.empleadoActual} confirmó el turno como ${data.rol}`);

        return {
            success: true,
            message: `¡Gracias ${data.empleadoActual}! Tu turno ha sido confirmado.`,
            empleado: data.empleadoActual,
            rol: data.rol
        };
    } catch (error) {
        console.error("Error procesando confirmación:", error);
        return { success: false, message: "Error al procesar" };
    }
}

/**
 * Procesa el rechazo y pregunta al siguiente candidato
 */
async function procesarRechazo(pendienteId, chatId) {
    try {
        const docRef = db.collection("AsignacionesPendientes").doc(pendienteId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, message: "Asignación no encontrada" };
        }

        const data = doc.data();

        if (data.estado !== "pendiente") {
            return { success: false, message: "Esta asignación ya fue procesada" };
        }

        const restantes = data.empleadosRestantes || [];

        if (restantes.length === 0) {
            // No hay más candidatos - notificar al admin
            await docRef.update({
                estado: "rechazado_todos",
                fechaRechazo: new Date().toISOString()
            });

            await notificarAdminRechazoTotal(data);

            return {
                success: true,
                message: "Entendido. Se ha notificado al administrador.",
                todosRechazaron: true
            };
        }

        // Hay más candidatos - preguntar al siguiente
        const siguienteCandidato = restantes[0];
        const todosEmpleados = data.todosLosEmpleados || {};

        // Buscar chatId del siguiente
        const empleadosSnapshot = await db.collection("Empleados").get();
        let siguienteChatId = null;

        empleadosSnapshot.forEach(empDoc => {
            const empData = empDoc.data();
            if ((empData.nombre || empDoc.id) === siguienteCandidato && empData.telegramChatId) {
                siguienteChatId = empData.telegramChatId;
            }
        });

        if (!siguienteChatId) {
            // El siguiente no tiene telegram, intentar con el que sigue
            await docRef.update({
                empleadoActual: siguienteCandidato,
                empleadosRestantes: restantes.slice(1),
                historialRechazos: admin.firestore.FieldValue.arrayUnion(data.empleadoActual)
            });

            return await procesarRechazo(pendienteId, chatId);
        }

        // Actualizar documento con nuevo candidato
        await docRef.update({
            empleadoActual: siguienteCandidato,
            chatIdActual: siguienteChatId,
            empleadosRestantes: restantes.slice(1),
            historialRechazos: admin.firestore.FieldValue.arrayUnion(data.empleadoActual),
            fechaEnvio: new Date().toISOString()
        });

        // Enviar mensaje al siguiente
        const mensaje = `📅 *Asignación de Turno Semanal*\n\n` +
            `Hola *${siguienteCandidato}*, te corresponde el turno como *${data.rol}*:\n\n` +
            `📆 Semana ${data.datosSemana.semana}\n` +
            `📅 ${data.datosSemana.fechaInicio} - ${data.datosSemana.fechaFin}\n\n` +
            `¿Puedes tomar este turno?`;

        await enviarMensajeConBotones(siguienteChatId, mensaje, pendienteId);

        console.log(`🔄 ${data.empleadoActual} rechazó. Preguntando a ${siguienteCandidato}...`);

        return {
            success: true,
            message: "Entendido. Se ha contactado a otro compañero.",
            siguienteEmpleado: siguienteCandidato
        };
    } catch (error) {
        console.error("Error procesando rechazo:", error);
        return { success: false, message: "Error al procesar" };
    }
}

/**
 * Notifica al admin que todos rechazaron
 */
async function notificarAdminRechazoTotal(data) {
    // Buscar admins en userRoles
    try {
        const adminsSnapshot = await db.collection("userRoles")
            .where("rol", "in", ["admin", "superadmin"])
            .get();

        const mensaje = `⚠️ *ALERTA: Turno sin asignar*\n\n` +
            `Todos los empleados del rol *${data.rol}* rechazaron el turno:\n\n` +
            `📆 Semana ${data.datosSemana.semana}\n` +
            `📅 ${data.datosSemana.fechaInicio} - ${data.datosSemana.fechaFin}\n\n` +
            `Por favor, realiza la asignación manualmente.`;

        // Buscar telegram de algún admin
        const empleadosSnapshot = await db.collection("Empleados").get();
        const adminEmails = [];
        adminsSnapshot.forEach(doc => adminEmails.push(doc.data().email));

        console.log(`⚠️ Todos rechazaron el rol ${data.rol}. Admins notificados: ${adminEmails.join(', ')}`);

        // Intentar enviar a contactos adicionales (que suelen ser admins)
        const contactosSnapshot = await db.collection("ContactosAdicionales").get();
        for (const doc of contactosSnapshot.docs) {
            const chatId = doc.data().chatId;
            if (chatId) {
                await enviarMensajeTelegramDirecto(chatId, mensaje);
            }
        }
    } catch (error) {
        console.error("Error notificando a admins:", error);
    }
}

/**
 * Verifica si todos los roles están confirmados y guarda la asignación final
 */
async function verificarYGuardarAsignacionCompleta(datosSemana) {
    try {
        const roles = ["tecnico", "ingeniero", "planta"];
        const asignaciones = {};
        let todosConfirmados = true;

        for (const rol of roles) {
            const pendienteId = `${datosSemana.año}-${datosSemana.mes}-${datosSemana.semana}-${rol}`;
            const doc = await db.collection("AsignacionesPendientes").doc(pendienteId).get();

            if (!doc.exists || doc.data().estado !== "confirmado") {
                todosConfirmados = false;
                break;
            }

            asignaciones[rol] = doc.data().empleadoActual;
        }

        if (todosConfirmados) {
            // Guardar asignación final
            const docId = `${datosSemana.año}-${datosSemana.mes}-${datosSemana.semana}`;

            await db.collection("AsignacionesSemanales").doc(docId).set({
                tecnico: asignaciones.tecnico,
                ingeniero: asignaciones.ingeniero,
                planta: asignaciones.planta,
                semana: datosSemana.semana,
                año: datosSemana.año,
                mes: datosSemana.mes,
                fechaInicio: datosSemana.fechaInicio,
                fechaFin: datosSemana.fechaFin,
                confirmadoPorTelegram: true,
                fechaCreacion: new Date().toISOString()
            });

            console.log(`✅ Asignación completa guardada: Técnico=${asignaciones.tecnico}, Ingeniero=${asignaciones.ingeniero}, Planta=${asignaciones.planta}`);

            // Notificar a todos los asignados
            const mensajeFinal = `🎉 *Turno Confirmado*\n\n` +
                `Semana ${datosSemana.semana} (${datosSemana.fechaInicio} - ${datosSemana.fechaFin})\n\n` +
                `👷 Técnico: ${asignaciones.tecnico}\n` +
                `👨‍💼 Ingeniero: ${asignaciones.ingeniero}\n` +
                `🏭 Planta: ${asignaciones.planta}\n\n` +
                `¡Todos confirmados! Gracias.`;

            const contactosSnapshot = await db.collection("ContactosAdicionales").get();
            for (const doc of contactosSnapshot.docs) {
                const chatId = doc.data().chatId;
                if (chatId) {
                    await enviarMensajeTelegramDirecto(chatId, mensajeFinal);
                }
            }
        }
    } catch (error) {
        console.error("Error verificando asignación completa:", error);
    }
}

async function triggerAssignment(req, res) {
    console.log(`🔧 Asignación manual disparada por: ${req.user.email || req.user.uid}`);
    const result = await asignarTurnosAutomaticos(true);
    res.json(result);
}

async function testAssignment(req, res) {
    console.log("🧪 PRUEBA: Disparando asignación de prueba...");
    const result = await asignarTurnosAutomaticos(true);
    res.json(result);
}

module.exports = {
    asignarTurnosAutomaticos,
    procesarConfirmacion,
    procesarRechazo,
    triggerAssignment,
    testAssignment
};
