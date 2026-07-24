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
      // 🛡️ PARCHE BLINDADO CONTRA OKLCH
      onclone: (clonedDoc) => {
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const style = window.getComputedStyle(el);
          
          // Propiedades CSS que suelen llevar colores de Tailwind
          const props = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'];
          
          props.forEach((prop) => {
            const val = style[prop];
            // Si el estilo computado incluye "oklch", forzamos un fallback a color sólido o transparente
            if (val && val.includes('oklch')) {
              if (prop === 'backgroundColor') el.style[prop] = '#1e293b'; // Slate 800
              else if (prop === 'color') el.style[prop] = '#f8fafc'; // Slate 50
              else if (prop === 'borderColor') el.style[prop] = '#334155'; // Slate 700
              else el.style[prop] = 'inherit';
            } else if (val) {
              el.style[prop] = val;
            }
          });
        });
      }
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  return html2pdf().set(opciones).from(element).save();
};