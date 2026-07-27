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

    await new Promise((resolve) => setTimeout(resolve, 300));

    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: bgColor, // 👈 Usamos la variable de color aquí
    });

    element.style.position = originalStyles.position;
    element.style.height = originalStyles.height;
    element.style.maxHeight = originalStyles.maxHeight;
    element.style.overflow = originalStyles.overflow;
    element.style.width = originalStyles.width;

    const pdf = new jsPDF('l', 'mm', 'a4'); 
    const imgWidth = 297; 
    const pageHeight = 210; 
    
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    const pintarFondoPdf = () => {
      pdf.setFillColor(bgColor); // 👈 Usamos la variable de color aquí también
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
    console.log('✅ ¡PDF generado con éxito!');
    
  } catch (error) {
    console.error('❌ Error crítico al generar el PDF:', error);
  }
};