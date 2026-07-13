const fs = require('fs');
const XLSX = require('xlsx');

const workbook = XLSX.readFile('Analisis de Tendencias de Materialización de Riesgos 2026.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Separación limpia usando los bloques de espacio del formato original de Excel
const splitSentences = (str) => {
    if (!str) return [];
    return String(str)
        .split(/\s{3,}|\r?\n/) // Rompe solo si hay saltos de línea o más de 3 espacios consecutivos
        .map(s => s.trim())
        .filter(s => s.length > 5);
};

const nuevaData = [];

data.forEach(row => {
    if (!row['No']) return;

    const descripciones = splitSentences(row['Descripción del Control']);
    
    if (descripciones.length === 0) {
        nuevaData.push({ ...row, 'Descripción del Control': 'Sin control definido' });
    } else {
        descripciones.forEach(desc => {
            nuevaData.push({
                ...row,
                'Descripción del Control': desc,
                'Tipo': String(row['Tipo'] || 'Preventivo').includes('Correctivo') ? 'Correctivo' : 'Preventivo',
                'Implementación': 'Manual'
            });
        });
    }
});

const newSheet = XLSX.utils.json_to_sheet(nuevaData);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Riesgos_Limpios");
XLSX.writeFile(newWorkbook, 'Matriz_Riesgos_Limpia_y_Lista.xlsx');

console.log(`¡Corregido! Archivo generado con descripciones de control completas.`);