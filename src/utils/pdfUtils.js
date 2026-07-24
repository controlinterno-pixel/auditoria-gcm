import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

  // Resolución flexible del objetivo (String, Ref o Elemento)
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
    // Usamos html-to-image con el motor nativo del navegador
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // Alta resolución para que el texto se lea nítido
      backgroundColor: '#0f172a', // Fondo slate-900 para evitar transparencias
      style: {
        overflow: 'hidden' // Evita que salgan barras de scroll en el PDF
      }
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; 
    const pageHeight = 297; 
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Primera página
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Páginas adicionales si el contenido es muy largo
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF generado con éxito!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};