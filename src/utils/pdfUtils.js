import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const generarPdfModal = async (elementId) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      // 🛡️ AQUÍ ESTÁ EL TRUCO: Convertimos los colores oklch antes de renderizar el PDF
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (!clonedElement) return;

        // Recorremos todos los elementos clonados
        const allElements = clonedElement.querySelectorAll('*');
        allElements.forEach((el) => {
          const style = window.getComputedStyle(el);
          
          // Si el color de texto o fondo contiene "oklch", forzamos a leer su versión computada en RGB
          if (style.color && style.color.includes('oklch')) {
            el.style.color = style.color;
          }
          if (style.backgroundColor && style.backgroundColor.includes('oklch')) {
            el.style.backgroundColor = style.backgroundColor;
          }
          if (style.borderColor && style.borderColor.includes('oklch')) {
            el.style.borderColor = style.borderColor;
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // Ancho A4 en mm
    const pageHeight = 297; // Alto A4 en mm
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

    pdf.save('Informe_Ejecutivo_GRC.pdf');
  } catch (error) {
    console.error('Error generando PDF:', error);
  }
};