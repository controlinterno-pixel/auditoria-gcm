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

    // 2. 🔥 EL TRUCO DEL BREAKOUT MEJORADO
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    // Forzamos un ancho fijo ideal (1200px) para que las columnas no se aplasten
    element.style.width = '1200px'; 
    element.style.height = 'max-content';             
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // 3. Pausa estratégica de 300ms para asegurar renderizado completo (incluyendo acordeones)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Tomar la fotografía
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
    });

    // 5. Restaurar el componente a la normalidad al instante
    element.style.position = originalStyles.position;
    element.style.height = originalStyles.height;
    element.style.maxHeight = originalStyles.maxHeight;
    element.style.overflow = originalStyles.overflow;
    element.style.width = originalStyles.width;

    // 6. 🎨 CONFIGURACIÓN JSPDF: MODO HORIZONTAL (LANDSCAPE)
    const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' significa Landscape (Horizontal)
    const imgWidth = 297; // Ancho máximo de la hoja A4 horizontal en mm
    const pageHeight = 210; // Alto de la hoja A4 horizontal en mm
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Utilidad para pintar el fondo de la página de color oscuro en lugar del blanco por defecto
    const pintarFondoPdf = () => {
      pdf.setFillColor('#0f172a'); // Color slate-900 (Fondo de tu UI)
      pdf.rect(0, 0, imgWidth, pageHeight, 'F');
    };

    // Plasmamos la primera página
    pintarFondoPdf();
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Generamos nuevas páginas si todavía queda imagen por imprimir
    while (heightLeft > 0) {
      position -= pageHeight; 
      pdf.addPage();
      pintarFondoPdf(); // Pintamos el fondo oscuro también en las hojas extra
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log('✅ ¡PDF horizontal generado con éxito!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};