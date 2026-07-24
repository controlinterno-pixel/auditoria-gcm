import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exporta un elemento a PDF aceptando:
 * 1. Un ID de string (ej: "seccion-pdf")
 * 2. Un HTML Element directo (ej: e.target o ref.current)
 * 3. Una React Ref
 */
export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

  // 1. Resolver qué nos pasaron como parámetro
  if (typeof target === 'string') {
    element = document.getElementById(target);
  } else if (target && target.current) { // Si es un React useRef
    element = target.current;
  } else if (target instanceof HTMLElement) { // Si es un elemento HTML directo
    element = target;
  }

  if (!element) {
    console.error('❌ Error en PDF: No se pudo identificar el elemento HTML a exportar.', target);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc, clonedElement) => {
        // Limpiar animaciones y arreglar estilos de color oklch/oklab
        const allElements = clonedElement.querySelectorAll('*');
        allElements.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.color && (style.color.includes('oklch') || style.color.includes('oklab'))) {
            el.style.color = style.color;
          }
          if (style.backgroundColor && (style.backgroundColor.includes('oklch') || style.backgroundColor.includes('oklab'))) {
            el.style.backgroundColor = style.backgroundColor;
          }
          if (style.borderColor && (style.borderColor.includes('oklch') || style.borderColor.includes('oklab'))) {
            el.style.borderColor = style.borderColor;
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('❌ Error al generar el PDF:', error);
  }
};