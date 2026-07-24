import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

  // Resolución flexible del objetivo (String, Ref o Elemento directo)
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
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false, // Apagamos el logging para mejorar rendimiento
      onclone: (clonedDoc) => {
        // 🔥 PARCHE NUCLEAR CONTRA EL ERROR "OKLCH" 🔥
        // Buscamos todas las etiquetas <style> (donde Tailwind inyecta sus variables)
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((style) => {
          // Usamos Regex para buscar cualquier función de color moderna no soportada 
          // y la reemplazamos por un color hexadecimal oscuro seguro (#1e293b)
          if (/(oklch|oklab|color-mix)/i.test(style.innerHTML)) {
            style.innerHTML = style.innerHTML.replace(/(oklch|oklab|color-mix)\([^)]+\)/gi, '#1e293b');
          }
        });

        // Limpieza de emergencia para estilos en línea (inline styles)
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const inlineStyle = el.getAttribute('style');
          if (inlineStyle && /(oklch|oklab|color-mix)/i.test(inlineStyle)) {
            el.setAttribute('style', inlineStyle.replace(/(oklch|oklab|color-mix)\([^)]+\)/gi, '#1e293b'));
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

    // Agregar la primera página
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Agregar páginas adicionales si el contenido desborda
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};