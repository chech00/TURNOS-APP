export function formatDate(date) {
    const year = date.getFullYear();
    const month = (`0${date.getMonth() + 1}`).slice(-2);
    const day = (`0${date.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
}

export function sumarDias(fecha, dias) {
    const result = new Date(fecha);
    result.setDate(result.getDate() + dias);
    return result;
}

export function obtenerSemanaActual() {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const año = hoy.getFullYear();
    const primerDiaDelMes = new Date(año, mes, 1);
    const diaSemanaPrimerDia = primerDiaDelMes.getDay() === 0 ? 7 : primerDiaDelMes.getDay();
    const diaDelMes = hoy.getDate();
    return Math.floor((diaDelMes + diaSemanaPrimerDia - 2) / 7);
}

export function calcularPascua(year) {
    let a = year % 19;
    let b = Math.floor(year / 100);
    let c = year % 100;
    let d = Math.floor(b / 4);
    let e = b % 4;
    let f = Math.floor((b + 8) / 25);
    let g = Math.floor((b - f + 1) / 3);
    let h = (19 * a + b - d - g + 15) % 30;
    let i = Math.floor(c / 4);
    let k = c % 4;
    let l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m = Math.floor((a + 11 * h + 22 * l) / 451);
    let month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    let day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

export function obtenerFeriadosMoviles(year) {
    const pascua = calcularPascua(year);
    const viernesSanto = new Date(pascua);
    viernesSanto.setDate(pascua.getDate() - 2);
    const sabadoSanto = new Date(pascua);
    sabadoSanto.setDate(pascua.getDate() - 1);
    return [
        { fecha: formatDate(viernesSanto), nombre: "Viernes Santo" },
        { fecha: formatDate(sabadoSanto), nombre: "Sábado Santo" }
    ];
}
