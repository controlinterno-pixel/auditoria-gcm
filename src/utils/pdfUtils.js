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
    // 1. Guardar los estilos originales para no romper la UI del usuario
    const originalHeight = element.style.height;
    const originalMaxHeight = element.style.maxHeight;
    const originalOverflow = element.style.overflow;

    // 2. Forzar la expansión real del contenedor en el DOM
    // Obligamos al elemento a medir exactamente lo que mide todo su contenido interno
    element.style.height = `${element.scrollHeight}px`;
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // 3. Pausa estratégica de 100ms. 
    // Esto asegura que el navegador tenga tiempo de renderizar el componente estirado antes de la foto.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Capturar la imagen ahora que el elemento está 100% expandido
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#0f172a', // Mantener tu fondo oscuro
    });

    // 5. Restaurar el contenedor a la normalidad inmediatamente
    element.style.height = originalHeight;
    element.style.maxHeight = originalMaxHeight;
    element.style.overflow = originalOverflow;

    // 6. Configuración del PDF y Paginación
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

    // Páginas adicionales
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF generado con la altura dinámica calculada correctamente!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};