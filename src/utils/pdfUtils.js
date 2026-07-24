import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf') => {
  let element = null;

  // Resolución del objetivo a exportar
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
    // 1. Respaldar los estilos originales del componente
    const originalStyles = {
      position: element.style.position,
      height: element.style.height,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      width: element.style.width,
    };

    // 2. 🔥 EL TRUCO DEL BREAKOUT: Romper las reglas del contenedor padre
    // 'absolute' lo saca del flujo normal, evitando que el alto de la pantalla (vh) lo limite.
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = `${element.scrollWidth}px`; // Congelamos su ancho actual
    element.style.height = 'max-content';             // Forzamos a que mida todo su contenido interno
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // 3. Pausa estratégica de 200ms para asegurar que el motor de renderizado asimile el nuevo tamaño enorme
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. Tomar la fotografía con el elemento totalmente desplegado
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
    });

    // 5. Restaurar el componente a la normalidad al instante (el usuario no notará nada)
    element.style.position = originalStyles.position;
    element.style.height = originalStyles.height;
    element.style.maxHeight = originalStyles.maxHeight;
    element.style.overflow = originalStyles.overflow;
    element.style.width = originalStyles.width;

    // 6. Configuración y Paginación (Corrección matemática incluida)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Plasmamos la primera página
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Generamos nuevas páginas si todavía queda imagen por imprimir
    while (heightLeft > 0) {
      position -= pageHeight; // Subimos la imagen exactamente el alto de una página para que el corte sea preciso
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF generado con éxito y sin recortes de pantalla!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};