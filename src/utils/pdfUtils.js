import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ⚠️ Asegúrate de que el nombre sea exactamente 'exportarA_PDF' con 'export const'
export const exportarA_PDF = async (elementId, fileName = 'informe.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`No se encontró el elemento con ID: ${elementId}`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (!clonedElement) return;

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
    console.error('Error al generar el PDF:', error);
  }
};