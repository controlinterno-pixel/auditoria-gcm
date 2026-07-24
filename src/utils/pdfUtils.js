import html2pdf from 'html2pdf.js';

export const exportarA_PDF = (element, filename = 'Reporte_GRC.pdf') => {
  if (!element) return;

  const opciones = {
    margin: 0.5,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a',
      // 🛡️ ESTE BLOQUE RESUELVE EL ERROR "unsupported color function oklch" DE TU CONSOLA
      onclone: (clonedDoc) => {
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.color) el.style.color = style.color;
          if (style.backgroundColor) el.style.backgroundColor = style.backgroundColor;
          if (style.borderColor) el.style.borderColor = style.borderColor;
        });
      }
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  return html2pdf().set(opciones).from(element).save();
};