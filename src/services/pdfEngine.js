// src/services/pdfEngine.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// 🖼️ BASE64 DEL LOGO CORPORATIVO (Reemplazar por el logo real de Termales)
// Usamos Base64 para evitar problemas de asincronía al cargar imágenes por URL en jsPDF
const LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

/**
 * 🛠️ Configuración de colores corporativos (Extraídos del diseño UI/PDF)
 */
const COLORS = {
  primary: [10, 59, 50],    // #0A3B32 (Verde oscuro institucional)
  secondary: [59, 130, 246], // #3b82f6 (Azul de acento)
  text: [51, 65, 85],       // #334155 (Slate 700)
  light: [100, 116, 139]    // #64748b (Slate 500)
};

/**
 * 📄 Genera el encabezado estándar para todas las páginas
 */
const drawHeader = (doc, data, tituloReporte, periodo) => {
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo corporativo
  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 10, 30, 15);
  } catch (e) {
    console.warn("No se pudo cargar el logo corporativo.", e);
  }

  // 2. Título principal del reporte
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text(tituloReporte, 50, 18);

  // 3. Subtítulo (Período o información adicional)
  if (periodo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text(`Período: ${periodo}`, 50, 24);
  }

  // 4. Línea separadora
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 28, pageWidth - 14, 28);
};

/**
 * 📄 Genera el pie de página con numeración y meta-información
 */
const drawFooter = (doc, data) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const today = new Date().toLocaleString('es-CO');

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.light);

  // Texto izquierdo (Sistema y Fecha)
  const footerText = `Termales Santa Rosa de Cabal - Sistema GRC | Generado: ${today}`;
  doc.text(footerText, 14, pageHeight - 10);

  // Numeración derecha (Página X)
  const pageText = `Página ${data.pageNumber} de ${pageCount}`;
  doc.text(pageText, pageWidth - 14, pageHeight - 10, { align: 'right' });
};

/**
 * 🚀 Función Principal: Exporta el Dashboard Ejecutivo a PDF
 * @param {Object} config - Configuración del reporte
 * @param {Array} config.imagenesGraficas - Array de base64 de las gráficas capturadas (Fase 2)
 * @param {Array} config.datosTabla - Array de objetos para la tabla (ej. Riesgos o Planes)
 */
export const generarPDFEjecutivo = (config) => {
  const { 
    titulo = "Reporte Ejecutivo GRC",
    periodo = "",
    imagenesGraficas = [],
    datosTabla = [],
    columnasTabla = [] 
  } = config;

  // Inicializar documento A4 vertical
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  let currentY = 35; // Posición inicial después del encabezado

  // Dibujar encabezado en la primera página manualmente
  drawHeader(doc, {}, titulo, periodo);

  // 📸 1. Inyectar capturas de gráficas (Client-Side Rendering)
  if (imagenesGraficas.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.text);
    doc.text("Métricas Ejecutivas y Tendencias", 14, currentY);
    currentY += 6;

    imagenesGraficas.forEach((imgBase64, index) => {
      // Ajuste de tamaño dinámico para que no desborde (A4 width = 210mm)
      const imgWidth = 182; // 210 - 28 (márgenes)
      const imgHeight = 60; // Altura fija de bloque
      
      // Control de salto de página manual para imágenes
      if (currentY + imgHeight > 270) {
        doc.addPage();
        drawHeader(doc, {}, titulo, periodo);
        currentY = 35;
      }

      doc.addImage(imgBase64, 'PNG', 14, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 8;
    });
  }

  // 📊 2. Dibujar Tablas Paginadas Automáticamente (autotable)
  if (datosTabla.length > 0 && columnasTabla.length > 0) {
    
    // Si queda muy poco espacio antes de iniciar la tabla, forzamos salto
    if (currentY > 230) {
      doc.addPage();
      currentY = 35;
    } else {
      currentY += 5; // Margen adicional antes de la tabla
    }

    doc.autoTable({
      startY: currentY,
      head: [columnasTabla.map(c => c.header)],
      body: datosTabla.map(row => columnasTabla.map(col => row[col.dataKey])),
      theme: 'grid',
      headStyles: { 
        fillColor: COLORS.primary, 
        textColor: 255, 
        fontStyle: 'bold',
        fontSize: 9 
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        textColor: COLORS.text 
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252] // bg-slate-50
      },
      margin: { top: 35, bottom: 20 },
      // Hooks para dibujar encabezados y pies en las nuevas páginas creadas por la tabla
      didDrawPage: (data) => {
        // El header de las páginas subsecuentes
        if (data.pageNumber > 1 || !imagenesGraficas.length) {
          drawHeader(doc, data, titulo, periodo);
        }
        drawFooter(doc, data);
      }
    });
  } else {
    // Si no hay tabla, dibujamos el footer de la última página manualmente
    drawFooter(doc, { pageNumber: doc.internal.getNumberOfPages() });
  }

  // Guardar archivo
  const safeTitle = titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`);
};