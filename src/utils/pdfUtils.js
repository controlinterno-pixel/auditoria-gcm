import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

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
    // 🔥 EL SECRETO PARA CONTENEDORES LARGOS:
    // Obligamos al canvas a tomar las dimensiones totales (incluyendo lo que hay que scrollear)
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, 
      backgroundColor: '#0f172a',
      width: element.scrollWidth,  // Captura el ancho total real
      height: element.scrollHeight, // Captura el alto total real (lo que está oculto abajo)
      style: {
        overflow: 'visible', // Desactiva la barra de scroll temporalmente
        maxHeight: 'none',   // Rompe cualquier límite de altura
        height: 'auto'       // Deja que el contenedor fluya libremente
      }
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; 
    const pageHeight = 297; 
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Agregar la primera página
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 🔥 Paginación automática: 
    // Si la imagen es más alta que una hoja A4, creará nuevas hojas automáticamente
    while (heightLeft > 0) {
      position = heightLeft - imgHeight; 
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF generado con el 100% de la información!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};