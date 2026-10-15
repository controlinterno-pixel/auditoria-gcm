import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportarA_PDF = async (
  target,
  fileName = 'Informe_GRC.pdf',
  bgColor = '#0f172a',
  { format = 'PNG', quality = 1, pixelRatio = 4, onProgress = () => {} } = {}
) => {
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
    return false;
  }

  const reportProgress = (stage) => {
    try {
      onProgress({ stage });
    } catch {
      // El reporte de progreso no debe interrumpir la exportación.
    }
  };
  const originalStyles = {
    position: element.style.position,
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    maxHeight: element.style.maxHeight,
    overflow: element.style.overflow,
    width: element.style.width,
  };
  let rows = [];
  let originalRowMargins = new Map();

  try {
    reportProgress('Preparando el informe…');
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '1350px';
    element.style.height = 'max-content';
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // =========================================================================
    // 🧠 ALGORITMO ANTI-GUILLOTINA (Saltos de página inteligentes)
    // =========================================================================
    const A4_WIDTH_MM = 297;
    const A4_HEIGHT_MM = 210;
    // Calculamos dinámicamente la altura exacta del corte según el ancho real del elemento (1350px)
    const TARGET_WIDTH_PX = element.scrollWidth || 1350;
    const PAGE_HEIGHT_PX = Math.floor(TARGET_WIDTH_PX * (A4_HEIGHT_MM / A4_WIDTH_MM));

    // Buscamos todas las filas que tengan la clase que pusimos (break-inside-avoid)
    rows = Array.from(element.querySelectorAll('.break-inside-avoid'));
    originalRowMargins = new Map(rows.map(row => [row, row.style.marginTop]));
    
    // Limpiamos márgenes previos por si el usuario presiona el botón 2 veces seguidas
    rows.forEach(row => { row.style.marginTop = '0px'; });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const containerRect = element.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      
      // Posición de esta fila relativa al contenedor principal
      const topRel = rowRect.top - containerRect.top;
      const bottomRel = rowRect.bottom - containerRect.top;

      const pageOfTop = Math.floor(topRel / PAGE_HEIGHT_PX);
      const pageOfBottom = Math.floor(bottomRel / PAGE_HEIGHT_PX);

      // Si el inicio de la fila está en una página y el final en otra... ¡Va a ser cortada!
      if (pageOfTop !== pageOfBottom) {
        // Empujamos la fila hacia abajo para que arranque limpia en la página siguiente
        const nextPageTop = (pageOfTop + 1) * PAGE_HEIGHT_PX;
        const pushAmount = nextPageTop - topRel;
        
        // Le damos un pequeño margen extra de 20px para que respire en la nueva hoja
        row.style.marginTop = `${pushAmount + 20}px`; 
      }
    }
    // =========================================================================

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    reportProgress('Renderizando páginas…');

    const opcionesImagen = {
      quality,
      pixelRatio,
      backgroundColor: bgColor, 
    };
    const formatoImagen = format === 'JPEG' ? 'JPEG' : 'PNG';
    const dataUrl = formatoImagen === 'JPEG'
      ? await toJpeg(element, opcionesImagen)
      : await toPng(element, opcionesImagen);

    reportProgress('Comprimiendo el documento…');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const imgWidth = 297;
    const pageHeight = 210;
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    const pintarFondoPdf = () => {
      pdf.setFillColor(bgColor); 
      pdf.rect(0, 0, imgWidth, pageHeight, 'F');
    };

    pintarFondoPdf();
    const alias = 'informe-institucional';
    const compression = formatoImagen === 'JPEG' ? 'FAST' : undefined;
    pdf.addImage(dataUrl, formatoImagen, 0, position, imgWidth, imgHeight, alias, compression);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pintarFondoPdf();
      pdf.addImage(dataUrl, formatoImagen, 0, position, imgWidth, imgHeight, alias, compression);
      heightLeft -= pageHeight;
    }

    reportProgress('Guardando archivo…');
    await pdf.save(fileName, { returnPromise: true });
    reportProgress('Descarga lista.');
    console.log('✅ ¡PDF generado con éxito y saltos de página calculados!');
    return true;
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
    return false;
  } finally {
    element.style.position = originalStyles.position;
    element.style.top = originalStyles.top;
    element.style.left = originalStyles.left;
    element.style.height = originalStyles.height;
    element.style.maxHeight = originalStyles.maxHeight;
    element.style.overflow = originalStyles.overflow;
    element.style.width = originalStyles.width;
    rows.forEach(row => { row.style.marginTop = originalRowMargins.get(row) || ''; });
  }
};