const fs = require('fs');
const XLSX = require('xlsx');

// 1. Carga tu archivo original (Asegúrate de que se llame así o cambia el nombre)
const workbook = XLSX.readFile('Analisis de Tendencias de Materialización de Riesgos 2026.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

const splitCamelCase = (str) => str ? String(str).match(/[A-Z][a-záéíóúñ]+/g) || [] : [];
const splitSentences = (str) => {
    if (!str) return [];
    let lineas = String(str).split(/\r?\n/);
    if (lineas.length === 1) lineas = String(str).split(/(?<=[a-z\.\)])\s*(?=[A-Z])/);
    return lineas.map(s => s.trim()).filter(s => s.length > 2);
};

const nuevaData = [];

data.forEach(row => {
    if (!row['No']) return;

    // Desarmar las celdas aplastadas
    const descripciones = splitSentences(row['Descripción del Control']);
    const tipos = splitCamelCase(row['Tipo']);
    const implementaciones = splitCamelCase(row['Implementación']);

    const maxLen = Math.max(descripciones.length, tipos.length, implementaciones.length);

    if (maxLen === 0) {
        nuevaData.push({ ...row, 'Descripción del Control': 'Sin control', 'Tipo': 'Preventivo', 'Implementación': 'Manual' });
    } else {
        // Separar en múltiples filas (1 fila por control)
        for (let i = 0; i < maxLen; i++) {
            nuevaData.push({
                ...row,
                'Descripción del Control': descripciones[i] || 'Control mitigante',
                'Tipo': tipos[i] || 'Preventivo',
                'Implementación': implementaciones[i] || 'Manual'
            });
        }
    }
});

// 2. Exportar el nuevo Excel arreglado
const newSheet = XLSX.utils.json_to_sheet(nuevaData);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Riesgos_Limpios");
XLSX.writeFile(newWorkbook, 'Matriz_Riesgos_Limpia_y_Lista.xlsx');

console.log(`¡Éxito! Se separaron los controles y se creó el archivo 'Matriz_Riesgos_Limpia_y_Lista.xlsx' con ${nuevaData.length} filas.`);