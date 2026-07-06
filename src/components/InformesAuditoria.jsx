import React, { useState } from 'react';

export default function InformesAuditoria({
  isAdmin, user, informesAuditoria, setInformesAuditoria, safeRiesgos, safeHallazgos, safePlanes, safeEvaluaciones, saveToCloud, formatSafeDate, searchTerm, setSearchTerm, columnFilters, handleColFilterChange, FilterInput
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'executive'
  const [selectedInforme, setSelectedInforme] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  
  // KPIs Globales
  const totalEmitidos = safeInformes.length;
  const totalSocializados = safeInformes.filter(i => i.socializado === 'Sí').length;
  const pctSocializados = totalEmitidos > 0 ? Math.round((totalSocializados / totalEmitidos) * 100) : 0;
  const pendientesSocializar = totalEmitidos - totalSocializados;
  
  const abrirCentroEjecutivo = (informe) => {
    setSelectedInforme(informe);
    setViewMode('executive');
    setActiveTab('resumen');
  };

  // ============================================================================
  // 🖨️ MOTOR AVANZADO PDF: DIBUJO MULTIPÁGINA ESTILO BIG 4 (VECTORIAL)
  // ============================================================================
  const generarPDFEjecutivo = async () => {
    if (!selectedInforme) return;
    setIsGeneratingPdf(true);

    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => { if (window.jspdf && !window.jsPDF) window.jsPDF = window.jspdf.jsPDF; resolve(); };
          script.onerror = reject; document.head.appendChild(script);
        });
      }
      if (!window.autoTable) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
          script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'pt', 'letter'); // Portrait, Puntos, Tamaño Carta
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Extracción de datos del informe seleccionado
      const hallazgosDelInforme = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
      const idsHallazgos = hallazgosDelInforme.map(h => h.id);
      const planesDelInforme = safePlanes.filter(p => idsHallazgos.includes(p.idHallazgo));
      
      const hallazgosCriticos = hallazgosDelInforme.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
      const avanceGlobal = planesDelInforme.length > 0 ? Math.round(planesDelInforme.reduce((acc, p) => acc + (p.progreso||0), 0) / planesDelInforme.length) : 0;

      // COLORES CORPORATIVOS
      const colorVerdeOscuro = [4, 47, 46]; // #042f2e
      const colorVerdeClaro = [16, 185, 129]; // #10b981
      const colorGris = [241, 245, 249]; // #f1f5f9

      const agregarHeader = (titulo, pagina) => {
        doc.setFillColor(...colorVerdeOscuro);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`TERMALES SANTA ROSA DE CABAL | ${titulo}`, 30, 25);
        doc.text(`PÁG. ${pagina}`, pageWidth - 60, 25);
      };

      // ---------------------------------------------------------
      // PÁGINA 1: PORTADA EJECUTIVA
      // ---------------------------------------------------------
      // Franja lateral izquierda
      doc.setFillColor(...colorVerdeOscuro);
      doc.rect(0, 0, 220, pageHeight, 'F');
      
      // Detalles de Portada (Izquierda)
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text("INFORME DE", 20, 150);
      doc.text("AUDITORÍA", 20, 180);
      doc.setTextColor(...colorVerdeClaro);
      doc.text("INTERNA", 20, 210);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(selectedInforme.ref, 20, 260);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`PROCESO: ${selectedInforme.proceso.toUpperCase()}`, 20, 290);
      
      doc.setFont("helvetica", "bold");
      doc.text("FECHA DE EMISIÓN:", 20, 360);
      doc.setFont("helvetica", "normal");
      doc.text(formatSafeDate(selectedInforme.fecha), 20, 375);

      doc.setFont("helvetica", "bold");
      doc.text("AUDITOR RESPONSABLE:", 20, 430);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.elaboradoPor, 20, 445);

      doc.setFont("helvetica", "bold");
      doc.text("ESTADO DEL INFORME:", 20, 500);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.socializado === 'Sí' ? 'EMITIDO Y SOCIALIZADO' : 'EMITIDO', 20, 515);

      // Título Grande (Derecha)
      doc.setTextColor(...colorVerdeOscuro);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const splitTitle = doc.splitTextToSize(selectedInforme.titulo.toUpperCase(), 320);
      doc.text(splitTitle, 250, 150);
      
      doc.setDrawColor(...colorVerdeClaro);
      doc.setLineWidth(3);
      doc.line(250, 170 + (splitTitle.length * 20), 300, 170 + (splitTitle.length * 20));

      // ---------------------------------------------------------
      // PÁGINA 2: RESUMEN EJECUTIVO Y KPIs
      // ---------------------------------------------------------
      doc.addPage();
      agregarHeader("RESUMEN EJECUTIVO", 2);

      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("1. OBJETIVO Y ALCANCE", 40, 80);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const objText = `Evaluar la eficacia de los controles, el cumplimiento normativo y la gestión de riesgos asociados a las operaciones del proceso de ${selectedInforme.proceso} en Termales Santa Rosa de Cabal, garantizando la mejora continua.`;
      doc.text(doc.splitTextToSize(objText, pageWidth - 80), 40, 105);

      // Cajas de KPI
      const drawKPIBox = (x, y, title, value, color) => {
        doc.setFillColor(...colorGris);
        doc.roundedRect(x, y, 110, 80, 8, 8, 'F');
        doc.setFillColor(...color);
        doc.roundedRect(x, y, 110, 5, 8, 8, 'F'); // Top accent
        doc.rect(x, y+2, 110, 3, 'F'); // Fix rounded corner artifact
        
        doc.setTextColor(...colorVerdeOscuro);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(title, x + 55, y + 25, { align: "center" });
        
        doc.setFontSize(24);
        doc.setTextColor(...color);
        doc.text(String(value), x + 55, y + 55, { align: "center" });
      };

      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("2. INDICADORES CLAVE (KPIs)", 40, 180);

      drawKPIBox(40, 200, "HALLAZGOS", hallazgosDelInforme.length, [239, 68, 68]);
      drawKPIBox(165, 200, "CRÍTICOS/ALTOS", hallazgosCriticos, [245, 158, 11]);
      drawKPIBox(290, 200, "PLANES", planesDelInforme.length, [59, 130, 246]);
      drawKPIBox(415, 200, "CUMPLIMIENTO", `${avanceGlobal}%`, [16, 185, 129]);

      // ---------------------------------------------------------
      // PÁGINA 3: DESGLOSE DE HALLAZGOS Y MATRIZ 
      // ---------------------------------------------------------
      doc.addPage();
      agregarHeader("HALLAZGOS IDENTIFICADOS", 3);

      const tableHallazgosData = hallazgosDelInforme.map((h, i) => [
        h.ref, 
        h.titulo, 
        h.severidad.toUpperCase(), 
        h.estado.toUpperCase()
      ]);

      doc.autoTable({
        startY: 60,
        head: [['ID HALLAZGO', 'DESCRIPCIÓN DE LA DESVIACIÓN', 'CRITICIDAD', 'ESTADO']],
        body: tableHallazgosData,
        theme: 'grid',
        headStyles: { fillColor: colorVerdeOscuro, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: 50 },
        columnStyles: { 
          0: { cellWidth: 80, fontStyle: 'bold' }, 
          2: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 70, halign: 'center' }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'CRÍTICO' || data.cell.raw === 'ALTO') data.cell.styles.textColor = [220, 38, 38];
            if (data.cell.raw === 'MEDIO') data.cell.styles.textColor = [217, 119, 6];
          }
        }
      });

      // Dibujar Mapa de Calor (Matriz 5x5 simulada)
      const startY = doc.lastAutoTable.finalY + 40;
      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. MAPA DE CALOR (RIESGOS ASOCIADOS)", 40, startY);

      const boxSize = 40;
      const startX = 150;
      const matY = startY + 30;

      // Colores de la matriz
      const getMatrixColor = (x, y) => {
        const score = x * y;
        if (score >= 16) return [239, 68, 68]; // Rojo
        if (score >= 10) return [249, 115, 22]; // Naranja
        if (score >= 6) return [250, 204, 21]; // Amarillo
        return [16, 185, 129]; // Verde
      };

      for (let y = 5; y >= 1; y--) {
        for (let x = 1; x <= 5; x++) {
          doc.setFillColor(...getMatrixColor(x, y));
          doc.rect(startX + ((x-1)*boxSize), matY + ((5-y)*boxSize), boxSize, boxSize, 'F');
          doc.setDrawColor(255,255,255);
          doc.rect(startX + ((x-1)*boxSize), matY + ((5-y)*boxSize), boxSize, boxSize, 'S');
        }
      }
      
      doc.setFontSize(8);
      doc.setTextColor(100,100,100);
      doc.text("Impacto ➡️", startX + 100, matY + 220);
      doc.text("Probabilidad ⬆️", startX - 20, matY + 100, { angle: 90 });

      // ---------------------------------------------------------
      // PÁGINA 4: PLANES DE ACCIÓN Y FIRMAS
      // ---------------------------------------------------------
      doc.addPage();
      agregarHeader("PLANES DE ACCIÓN Y APROBACIÓN", 4);

      const tablePlanesData = planesDelInforme.map((p) => [
        `PLAN-${p.id}`, 
        p.accion, 
        p.responsable, 
        formatSafeDate(p.fecha), 
        `${p.progreso || 0}%`
      ]);

      doc.autoTable({
        startY: 60,
        head: [['ID PLAN', 'ACCIÓN CORRECTIVA', 'RESPONSABLE', 'VENCIMIENTO', 'AVANCE']],
        body: tablePlanesData.length > 0 ? tablePlanesData : [['-', 'No hay planes de acción definidos', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: colorVerdeOscuro, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: 50 },
      });

      // FIRMAS Y VALIDACIÓN
      const signY = doc.lastAutoTable.finalY + 80;
      doc.setFillColor(...colorGris);
      doc.roundedRect(40, signY, pageWidth - 80, 120, 10, 10, 'F');

      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("VALIDACIÓN Y FIRMAS DEL INFORME", 60, signY + 25);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(1);
      
      // Firma 1
      doc.line(60, signY + 80, 180, signY + 80);
      doc.setFontSize(8);
      doc.text("Elaborado Por (Auditor)", 60, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.elaboradoPor || 'N/A', 60, signY + 105);

      // Firma 2
      doc.setFont("helvetica", "bold");
      doc.line(220, signY + 80, 340, signY + 80);
      doc.text("Revisado Por", 220, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.revisadoPor || 'N/A', 220, signY + 105);

      // Firma 3
      doc.setFont("helvetica", "bold");
      doc.line(380, signY + 80, 500, signY + 80);
      doc.text("Aprobado Por", 380, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.aprobadoPor || 'N/A', 380, signY + 105);

      // Guardar PDF
      doc.save(`Informe_Ejecutivo_${selectedInforme.ref}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  // ============================================================================
  // RENDER PRINCIPAL: MODO LISTA VS MODO EJECUTIVO
  // ============================================================================
  if (viewMode === 'executive' && selectedInforme) {
    // Extracción rápida de datos del informe abierto
    const hInfo = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
    const hCrit = hInfo.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
    const idsH = hInfo.map(h => h.id);
    const pInfo = safePlanes.filter(p => idsH.includes(p.idHallazgo));
    const avance = pInfo.length > 0 ? Math.round(pInfo.reduce((a, b) => a + (b.progreso||0), 0) / pInfo.length) : 0;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
        
        {/* TOP BAR NAVEGACIÓN */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setViewMode('list')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center space-x-2 transition-colors">
            <span>←</span> <span>Volver al Repositorio</span>
          </button>
          <div className="flex space-x-3">
            <button onClick={generarPDFEjecutivo} disabled={isGeneratingPdf} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-md transition-all">
              <span>{isGeneratingPdf ? '⏳' : '📥'}</span> <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF Ejecutivo'}</span>
            </button>
            <button className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-sm transition-all">
              <span>✉️</span> <span>Enviar / Distribuir</span>
            </button>
          </div>
        </div>

        {/* CONTENEDOR SPLIT (Master-Detail) */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* PANEL IZQUIERDO: PREVIEW TIPO PORTADA DE INFORME */}
          <div className="lg:w-1/3 shrink-0">
            <div className="bg-gradient-to-b from-[#0A3B32] to-[#115e59] rounded-3xl shadow-xl overflow-hidden text-white p-8 aspect-[1/1.4] flex flex-col justify-between relative border-4 border-white ring-1 ring-slate-200">
              {/* Decoración gráfica */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              
              <div>
                <div className="flex items-center space-x-3 mb-10">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl shadow-inner">💧</div>
                  <div>
                    <h2 className="text-lg font-black leading-none tracking-tight">TERMALES</h2>
                    <p className="text-[10px] text-emerald-200 font-bold">Santa Rosa de Cabal</p>
                  </div>
                </div>
                
                <h3 className="text-3xl font-black leading-tight mb-2">INFORME DE<br/>AUDITORÍA<br/><span className="text-emerald-400">INTERNA</span></h3>
                <p className="text-xl font-mono font-black text-white/90 mb-4">{selectedInforme.ref}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 bg-black/20 inline-block px-3 py-1 rounded-lg border border-white/10">
                  {selectedInforme.proceso}
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Estado</span>
                    <span className="text-[10px] font-black bg-emerald-500 px-2 py-0.5 rounded text-white shadow-sm uppercase">{selectedInforme.socializado === 'Sí' ? 'EMITIDO Y SOCIALIZADO' : 'EMITIDO'}</span>
                  </div>
                  <p className="text-xs font-medium"><span className="text-emerald-200/70">Emisión:</span> {formatSafeDate(selectedInforme.fecha)}</p>
                  <p className="text-xs font-medium mt-1"><span className="text-emerald-200/70">Auditor:</span> {selectedInforme.elaboradoPor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: TABS Y DATOS */}
          <div className="lg:w-2/3 flex flex-col space-y-4">
            
            {/* Cabecera del panel */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-black text-slate-800">{selectedInforme.titulo}</h2>
              <div className="flex items-center space-x-4 mt-3 border-t border-slate-100 pt-3">
                 <button onClick={() => setActiveTab('resumen')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>📄 Resumen Ejecutivo</button>
                 <button onClick={() => setActiveTab('hallazgos')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'hallazgos' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>⚠️ Hallazgos ({hInfo.length})</button>
                 <button onClick={() => setActiveTab('planes')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'planes' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✅ Planes ({pInfo.length})</button>
                 <button onClick={() => setActiveTab('firmas')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'firmas' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✍️ Firmas y Actas</button>
              </div>
            </div>

            {/* Contenido de la Tab Activa */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
              
              {activeTab === 'resumen' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Hallazgos</p>
                      <p className="text-3xl font-black text-slate-800">{hInfo.length}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Críticos</p>
                      <p className="text-3xl font-black text-red-600">{hCrit}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-1">Planes Asignados</p>
                      <p className="text-3xl font-black text-blue-700">{pInfo.length}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Cumplimiento</p>
                      <p className="text-3xl font-black text-emerald-600">{avance}%</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2 border-b pb-1">Contexto y Alcance</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      El presente informe detalla los resultados de la auditoría ejecutada al proceso de <b>{selectedInforme.proceso}</b>, cuyo objetivo principal fue evaluar la eficacia de los controles, la continuidad del negocio y el nivel de exposición al riesgo. Durante el trabajo de campo se validó la evidencia registrada en la plataforma GRC Auditor.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'hallazgos' && (
                <div className="space-y-4 animate-in fade-in">
                  {hInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay hallazgos registrados para este informe.</p> : 
                    hInfo.map((h, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-start">
                        <div>
                           <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded uppercase">{h.ref}</span>
                           <h4 className="text-sm font-bold text-slate-800 mt-2">{h.titulo}</h4>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${h.severidad==='Crítico'?'bg-red-100 text-red-700 border-red-200':'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {h.severidad}
                        </span>
                      </div>
                    ))
                  }
                </div>
              )}

              {activeTab === 'planes' && (
                <div className="space-y-4 animate-in fade-in">
                  {pInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay planes de acción vinculados a los hallazgos de este informe.</p> : 
                    pInfo.map((p, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                         <div className="flex-1 pr-4">
                           <p className="text-xs font-bold text-slate-800">{p.accion}</p>
                           <p className="text-[10px] text-slate-500 mt-1">Resp: {p.responsable} | Vence: {formatSafeDate(p.fecha)}</p>
                         </div>
                         <div className="w-24 text-center shrink-0 border-l border-slate-200 pl-4">
                           <p className="text-xl font-black text-blue-600">{p.progreso||0}%</p>
                           <p className="text-[8px] font-bold uppercase text-slate-400">Avance</p>
                         </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {activeTab === 'firmas' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Elaborado Por</p>
                      <div className="h-10 border-b border-dashed border-slate-300 mx-6 mb-2"></div>
                      <p className="text-sm font-bold text-slate-800">{selectedInforme.elaboradoPor || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500">Auditor Responsable</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Revisado Por</p>
                      <div className="h-10 border-b border-dashed border-slate-300 mx-6 mb-2"></div>
                      <p className="text-sm font-bold text-slate-800">{selectedInforme.revisadoPor || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500">Líder / Supervisor</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Aprobado Por</p>
                      <div className="h-10 border-b border-dashed border-slate-300 mx-6 mb-2"></div>
                      <p className="text-sm font-bold text-slate-800">{selectedInforme.aprobadoPor || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500">Dirección General</p>
                    </div>
                  </div>
                  
                  {/* ENLACES A DOCUMENTOS ORIGINALES */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex justify-around">
                     {selectedInforme.evidenciaUrl && (
                        <a href={selectedInforme.evidenciaUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center hover:scale-105 transition-transform">
                          <span className="text-3xl mb-1">📄</span>
                          <span className="text-[10px] font-bold text-blue-600 uppercase">Ver PDF Original</span>
                        </a>
                     )}
                     {selectedInforme.actaSocializacionUrl && (
                        <a href={selectedInforme.actaSocializacionUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center hover:scale-105 transition-transform">
                          <span className="text-3xl mb-1">🤝</span>
                          <span className="text-[10px] font-bold text-purple-600 uppercase">Ver Acta Socialización</span>
                        </a>
                     )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER PREDETERMINADO: MODO LISTA (DASHBOARD GENERAL)
  // ============================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER TIPO DASHBOARD */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-[#0A3B32] rounded-2xl flex items-center justify-center shadow-inner text-white text-xl">
              📊
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Centro de Informes Ejecutivos</h2>
              <p className="text-xs text-slate-500 font-bold mt-1">Repositorio de dictámenes, trazabilidad, firmas y distribución.</p>
            </div>
          </div>
        </div>

        {/* TARJETAS DE KPIs SUPERIORES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-center space-x-4">
            <div className="text-emerald-600 text-3xl">📄</div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{totalEmitidos}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">Informes Emitidos</p>
            </div>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center space-x-4">
            <div className="text-blue-600 text-3xl">👥</div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{totalSocializados}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">Socializados ({pctSocializados}%)</p>
            </div>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-center space-x-4">
            <div className="text-amber-600 text-3xl">🕒</div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{pendientesSocializar}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">Por Socializar</p>
            </div>
          </div>
          <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl flex items-center space-x-4">
            <div className="text-red-600 text-3xl">⚠️</div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{safeInformes.filter(i => safeHallazgos.some(h => String(h.idInforme) === String(i.id) && h.severidad === 'Crítico')).length}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">Con Hallazgos Críticos</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4 w-1/3">Informe y Título</th>
              <th className="p-4">Proceso Auditado</th>
              <th className="p-4">Fecha Emisión</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700 bg-white">
            {safeInformes.map((inf, idx) => (
              <tr key={`inf-row-${inf.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                <td className="p-4 flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${inf.socializado === 'Sí' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    📄
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">{inf.ref}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[250px]">{inf.titulo}</div>
                  </div>
                </td>
                <td className="p-4 font-bold text-slate-700">{inf.proceso}</td>
                <td className="p-4 text-slate-500">{formatSafeDate(inf.fecha)}</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {inf.socializado === 'Sí' ? 'SOCIALIZADO' : 'EMITIDO'}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => abrirCentroEjecutivo(inf)} className="bg-white border border-slate-200 hover:border-[#0A3B32] hover:text-[#0A3B32] text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm">
                    👁️ Ver Detalle
                  </button>
                </td>
              </tr>
            ))}
            {safeInformes.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400 font-bold italic">No hay informes emitidos registrados en la plataforma.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}