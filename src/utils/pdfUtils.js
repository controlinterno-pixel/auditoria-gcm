import html2pdf from 'html2pdf.js';

export const exportarA_PDF = (element, filename = 'Reporte_GRC.pdf') => {
  if (!element) return;

  const opciones = {
    margin: 0.3,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#0f172a', // Fondo oscuro por defecto (slate-900)
      onclone: (clonedDoc, clonedElement) => {
        // 1. Inyectamos un CSS global en el clon que deshace funciones de color modernas
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          * {
            /* Forzamos que las transiciones o gradientes complejos no bloqueen el canvas */
            transition: none !important;
            animation: none !important;
          }
        `;
        clonedDoc.head.appendChild(style);

        // 2. Recorremos TODOS los elementos del DOM clonado
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const computed = window.getComputedStyle(el);
          
          // Reemplazo directo en los estilos inline convertidos a valores computados compatibles
          ['backgroundColor', 'color', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach((prop) => {
            const colorVal = computed[prop];
            
            // Si detecta cualquier formato no soportado (oklch, oklab, color-mix, etc.)
            if (colorVal && (colorVal.includes('oklch') || colorVal.includes('oklab') || colorVal.includes('color(') || colorVal.includes('color-mix'))) {
              
              // Asignación de fallback inteligente según la propiedad
              if (prop === 'backgroundColor') {
                el.style.setProperty('background-color', '#1e293b', 'important'); // slate-800
              } else if (prop === 'color') {
                el.style.setProperty('color', '#f8fafc', 'important'); // slate-50
              } else if (prop === 'borderColor') {
                el.style.setProperty('border-color', '#334155', 'important'); // slate-700
              } else {
                el.style.setProperty(prop, 'transparent', 'important');
              }
            }
          });
        });
      }
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  return html2pdf().set(opciones).from(element).save();
};