// FUNCIÓN INTELIGENTE: Solo agrega empleados faltantes SIN tocar filas existentes
function agregarEmpleadosFaltantes() {
    const tablaGeneral = document.getElementById("general-calendar");
    if (!tablaGeneral) return;

    const tbody = tablaGeneral.querySelector("tbody");
    if (!tbody) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 1. Obtener nombres de empleados que YA están en el DOM
    const empleadosEnDOM = new Set();
    tbody.querySelectorAll("tr").forEach(row => {
        const firstCell = row.querySelector("td");
        if (firstCell) {
            const nombre = firstCell.textContent.replace(/⚠️/g, "").trim();
            if (nombre && nombre !== "Encargado de Bitácora") {
                empleadosEnDOM.add(nombre);
            }
        }
    });

    // 2. Detectar empleados DIURNOS que faltan
    const empleadosFaltantes = empleados.filter(emp => {
        const tipoTurno = emp.tipoTurno || "diurno";
        return tipoTurno === "diurno" && !empleadosEnDOM.has(emp.nombre);
    });

    if (empleadosFaltantes.length === 0) {
        console.log("[SYNC] No hay empleados diurnos faltantes");
        return;
    }

    console.log(`[SYNC] Agregando ${empleadosFaltantes.length} empleado(s) faltante(s):`, empleadosFaltantes.map(e => e.nombre));

    // 3. Encontrar la fila de bitácora (última fila)
    const filaBitacora = tbody.querySelector('tr:has(td.bitacora-row)');

    // 4. Crear y agregar filas SOLO para empleados faltantes
    empleadosFaltantes.forEach((empleado, index) => {
        const posicion = empleados.indexOf(empleado) + 1;
        const tienePrivilegios = posicion <= 2;

        let rowHTML = `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const fecha = new Date(year, month, day);
            const esDomingo = fecha.getDay() === 0;
            const esFeriado = feriadosChile.includes(dateStr);

            let turno = "";
            if (tienePrivilegios && esDomingo) {
                turno = "DL";
            }

            let extraClass = turno === "DL" ? "domingo-libre" : "";
            if (esFeriado && tienePrivilegios) extraClass += " feriado";

            rowHTML += `
        <td>
          <button
            data-date="${dateStr}"
            data-empleado="${empleado.nombre}"
            data-day="${day}"
            class="calendar-day w-full h-full ${extraClass}"
          >
            ${turno}
          </button>
        </td>
      `;
        }
        rowHTML += "</tr>";

        // Insertar ANTES de la fila de bitácora (si existe) o al final
        if (filaBitacora) {
            filaBitacora.insertAdjacentHTML('beforebegin', rowHTML);
        } else {
            tbody.insertAdjacentHTML('beforeend', rowHTML);
        }
    });

    // 5. Re-adjuntar event listeners a las nuevas celdas
    if (usuarioEsAdmin) {
        attachAdminCellListeners();
    }
}

// Función similar para empleados NOCTURNOS
function agregarEmpleadosNocturnosFaltantes() {
    const tablaNocturno = document.getElementById("nocturno-calendar");
    if (!tablaNocturno) return;

    const tbody = tablaNocturno.querySelector("tbody");
    if (!tbody) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 1. Obtener nombres de empleados que YA están en el DOM
    const empleadosEnDOM = new Set();
    tbody.querySelectorAll("tr").forEach(row => {
        const firstCell = row.querySelector("td");
        if (firstCell) {
            const nombre = firstCell.textContent.trim();
            if (nombre) empleadosEnDOM.add(nombre);
        }
    });

    // 2. Detectar empleados NOCTURNOS que faltan
    const empleadosFaltantes = empleados.filter(emp => {
        const tipoTurno = emp.tipoTurno || "diurno";
        return tipoTurno === "nocturno" && !empleadosEnDOM.has(emp.nombre);
    });

    if (empleadosFaltantes.length === 0) {
        console.log("[SYNC] No hay empleados nocturnos faltantes");
        return;
    }

    console.log(`[SYNC] Agregando ${empleadosFaltantes.length} nocturno(s) faltante(s):`, empleadosFaltantes.map(e => e.nombre));

    // 3. Crear y agregar filas
    empleadosFaltantes.forEach(empleado => {
        let rowHTML = `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const fecha = new Date(year, month, day);
            const esFeriado = feriadosChile.includes(dateStr);
            const dayOfWeek = fecha.getDay();

            let turno = "", turnoClass = "";
            if (esFeriado) { turno = "F"; turnoClass = "feriado"; }
            else if (dayOfWeek === 0) { turno = "DL"; turnoClass = "domingo-libre"; }
            else if (dayOfWeek === 6) { turno = "L"; turnoClass = "dia-libre"; }
            else { turno = "N"; turnoClass = "nocturno"; }

            rowHTML += `<td><button data-date="${dateStr}" data-empleado="${empleado.nombre}" data-day="${day}" class="calendar-day w-full h-full ${turnoClass}">${turno}</button></td>`;
        }
        rowHTML += "</tr>";

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });

    // Re-adjuntar listeners
    if (usuarioEsAdmin) {
        attachAdminCellListeners();
    }
}
