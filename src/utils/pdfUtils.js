import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

  // 1. Resolución flexible del objetivo
  if (typeof target === 'string') {
    element = document.getElementById(target);
  } else if (target && target.current) {
    element = target.current;
  } else if (target instanceof HTMLElement) {
    element = target;
  }

  if (!element) {
    console.error('❌ Error en PDF: No se pudo identificar el elemento HTML a exportar.');
    return;
  }

  try {
    // 2. Usamos html-to-image. Esto usa el motor nativo del navegador (<foreignObject>)
    // por lo que soporta oklch, oklab, y CSS moderno sin fallar.
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // Alta resolución
      backgroundColor: '#0f172a', // Fondo oscuro por defecto (Tailwind slate-900) para evitar transparencias raras
      style: {
        // Aseguramos que el contenedor no tenga scrollbars durante la captura
        overflow: 'hidden'
      }
    });

    // 3. Configuración de jsPDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // Ancho A4 en mm
    const pageHeight = 297; // Alto A4 en mm
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // 4. Inserción de la primera página
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 5. Bucle para múltiples páginas si el contenido es muy largo
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 6. Descarga del archivo
    pdf.save(fileName);
    console.log('✅ PDF generado con éxito utilizando html-to-image');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};