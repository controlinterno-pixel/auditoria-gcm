import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// 🔥 Agregamos 'bgColor' como tercer parámetro, por defecto el azul oscuro
export const exportarA_PDF = async (target, fileName = 'Informe_GRC.pdf', bgColor = '#0f172a') => {
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
    const originalStyles = {
      position: element.style.position,
      height: element.style.height,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      width: element.style.width,
    };

    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '1200px'; 
    element.style.height = 'max-content';             
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // =========================================================================
    // 🧠 ALGORITMO ANTI-GUILLOTINA (Saltos de página inteligentes)
    // =========================================================================
    const A4_WIDTH_MM = 297; 
    const A4_HEIGHT_MM = 210;
    // Calculamos dónde caerá la guillotina del PDF en píxeles reales de pantalla
    const PAGE_HEIGHT_PX = Math.floor(1200 * (A4_HEIGHT_MM / A4_WIDTH_MM)); 

    // Buscamos todas las filas que tengan la clase que pusimos (break-inside-avoid)
    const rows = Array.from(element.querySelectorAll('.break-inside-avoid'));
    
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

    await new Promise((resolve) => setTimeout(resolve, 300));

    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: bgColor, 
    });

    // Restaurar los estilos originales y limpiar los espacios en blanco inyectados
    element.style.position = originalStyles.position;
    element.style.height = originalStyles.height;
    element.style.maxHeight = originalStyles.maxHeight;
    element.style.overflow = originalStyles.overflow;
    element.style.width = originalStyles.width;
    rows.forEach(row => { row.style.marginTop = '0px'; });

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
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight; 
      pdf.addPage();
      pintarFondoPdf(); 
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF generado con éxito y saltos de página calculados!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};