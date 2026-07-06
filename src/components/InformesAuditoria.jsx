import React, { useState } from 'react';

export default function InformesAuditoria({ 
  informesAuditoria, 
  setInformesAuditoria, 
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  user,
  searchTerm, 
  setSearchTerm, 
  columnFilters, 
  setColumnFilters, 
  handleColFilterChange, 
  exportToExcel, 
  handleInformeAuditoriaSubmit, 
  isSubmitting, 
  setFormResetKey, 
  formResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput,
  safeHallazgos = [],
  safePlanes = [],
  formatSafeDate = (d) => d
}) {
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  
  // Estados para controlar si vemos el formulario normal o el Centro Ejecutivo
  const [viewMode, setViewMode] = useState('list'); 
  const [selectedInforme, setSelectedInforme] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const abrirCentroEjecutivo = (informe) => {
    setSelectedInforme(informe);
    setViewMode('executive');
    setActiveTab('resumen');
  };

  // ============================================================================
  // 🖨️ MOTOR PDF BIG-4
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
      const doc = new jsPDF('p', 'pt', 'letter'); 
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const hallazgosDelInforme = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
      const idsHallazgos = hallazgosDelInforme.map(h => h.id);
      const planesDelInforme = safePlanes.filter(p => idsHallazgos.includes(p.idHallazgo));
      
      const hallazgosCriticos = hallazgosDelInforme.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
      const avanceGlobal = planesDelInforme.length > 0 ? Math.round(planesDelInforme.reduce((acc, p) => acc + (p.progreso||0), 0) / planesDelInforme.length) : 0;

      const colorVerdeOscuro = [4, 47, 46];
      const colorVerdeClaro = [16, 185, 129]; 
      const colorGris = [241, 245, 249]; 

      const agregarHeader = (titulo, pagina) => {
        doc.setFillColor(...colorVerdeOscuro);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`TERMALES SANTA ROSA DE CABAL | ${titulo}`, 30, 25);
        doc.text(`PÁG. ${pagina}`, pageWidth - 60, 25);
      };

      // PÁGINA 1
      doc.setFillColor(...colorVerdeOscuro);
      doc.rect(0, 0, 220, pageHeight, 'F');
      
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

      doc.setTextColor(...colorVerdeOscuro);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const splitTitle = doc.splitTextToSize(selectedInforme.titulo.toUpperCase(), 320);
      doc.text(splitTitle, 250, 150);
      
      doc.setDrawColor(...colorVerdeClaro);
      doc.setLineWidth(3);
      doc.line(250, 170 + (splitTitle.length * 20), 300, 170 + (splitTitle.length * 20));

      // PÁGINA 2
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

      const drawKPIBox = (x, y, title, value, color) => {
        doc.setFillColor(...colorGris);
        doc.roundedRect(x, y, 110, 80, 8, 8, 'F');
        doc.setFillColor(...color);
        doc.roundedRect(x, y, 110, 5, 8, 8, 'F'); 
        doc.rect(x, y+2, 110, 3, 'F'); 
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

      // PÁGINA 3
      doc.addPage();
      agregarHeader("HALLAZGOS IDENTIFICADOS", 3);

      const tableHallazgosData = hallazgosDelInforme.map((h) => [
        h.ref, h.titulo, h.severidad.toUpperCase(), h.estado.toUpperCase()
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

      const startY = doc.lastAutoTable.finalY + 40;
      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. MAPA DE CALOR (RIESGOS ASOCIADOS)", 40, startY);

      const boxSize = 40;
      const startX = 150;
      const matY = startY + 30;

      const getMatrixColor = (x, y) => {
        const score = x * y;
        if (score >= 16) return [239, 68, 68];
        if (score >= 10) return [249, 115, 22]; 
        if (score >= 6) return [250, 204, 21]; 
        return [16, 185, 129]; 
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

      // PÁGINA 4
      doc.addPage();
      agregarHeader("PLANES DE ACCIÓN Y APROBACIÓN", 4);

      const tablePlanesData = planesDelInforme.map((p) => [
        `PLAN-${p.id}`, p.accion, p.responsable, formatSafeDate(p.fecha), `${p.progreso || 0}%`
      ]);

      doc.autoTable({
        startY: 60,
        head: [['ID PLAN', 'ACCIÓN CORRECTIVA', 'RESPONSABLE', 'VENCIMIENTO', 'AVANCE']],
        body: tablePlanesData.length > 0 ? tablePlanesData : [['-', 'No hay planes de acción definidos', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: colorVerdeOscuro, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: 50 },
      });

      const signY = doc.lastAutoTable.finalY + 80;
      doc.setFillColor(...colorGris);
      doc.roundedRect(40, signY, pageWidth - 80, 120, 10, 10, 'F');

      doc.setTextColor(...colorVerdeOscuro);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("VALIDACIÓN Y FIRMAS DEL INFORME", 60, signY + 25);
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(1);
      
      doc.line(60, signY + 80, 180, signY + 80);
      doc.setFontSize(8);
      doc.text("Elaborado Por (Auditor)", 60, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.elaboradoPor || 'N/A', 60, signY + 105);

      doc.setFont("helvetica", "bold");
      doc.line(220, signY + 80, 340, signY + 80);
      doc.text("Revisado Por", 220, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.revisadoPor || 'N/A', 220, signY + 105);

      doc.setFont("helvetica", "bold");
      doc.line(380, signY + 80, 500, signY + 80);
      doc.text("Aprobado Por", 380, signY + 95);
      doc.setFont("helvetica", "normal");
      doc.text(selectedInforme.aprobadoPor || 'N/A', 380, signY + 105);

      doc.save(`Informe_Ejecutivo_${selectedInforme.ref}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ============================================================================
  // VISTA 1: CENTRO EJECUTIVO (Cuando se hace clic en el botón oscuro)
  // ============================================================================
  if (viewMode === 'executive' && selectedInforme) {
    const hInfo = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
    const hCrit = hInfo.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
    const idsH = hInfo.map(h => h.id);
    const pInfo = safePlanes.filter(p => idsH.includes(p.idHallazgo));
    const avance = pInfo.length > 0 ? Math.round(pInfo.reduce((a, b) => a + (b.progreso||0), 0) / pInfo.length) : 0;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setViewMode('list')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center space-x-2 transition-colors">
            <span>←</span> <span>Volver a Formulario de Registro</span>
          </button>
          <div className="flex space-x-3">
            <button onClick={generarPDFEjecutivo} disabled={isGeneratingPdf} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-md transition-all">
              <span>{isGeneratingPdf ? '⏳' : '📥'}</span> <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF Ejecutivo'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3 shrink-0">
            <div className="bg-gradient-to-b from-[#0A3B32] to-[#115e59] rounded-3xl shadow-xl overflow-hidden text-white p-8 aspect-[1/1.4] flex flex-col justify-between relative border-4 border-white ring-1 ring-slate-200">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <div>
                <div className="flex items-center space-x-3 mb-10">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl shadow-inner">💧</div>
                  <div><h2 className="text-lg font-black leading-none tracking-tight">TERMALES</h2><p className="text-[10px] text-emerald-200 font-bold">Santa Rosa de Cabal</p></div>
                </div>
                <h3 className="text-3xl font-black leading-tight mb-2">INFORME DE<br/>AUDITORÍA<br/><span className="text-emerald-400">INTERNA</span></h3>
                <p className="text-xl font-mono font-black text-white/90 mb-4">{selectedInforme.ref}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 bg-black/20 inline-block px-3 py-1 rounded-lg border border-white/10">{selectedInforme.proceso}</p>
              </div>
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Estado</span>
                    <span className="text-[10px] font-black bg-emerald-500 px-2 py-0.5 rounded text-white shadow-sm uppercase">{selectedInforme.socializado === 'Sí' ? 'SOCIALIZADO' : 'EMITIDO'}</span>
                  </div>
                  <p className="text-xs font-medium"><span className="text-emerald-200/70">Emisión:</span> {formatSafeDate(selectedInforme.fecha)}</p>
                  <p className="text-xs font-medium mt-1"><span className="text-emerald-200/70">Auditor:</span> {selectedInforme.elaboradoPor}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-2/3 flex flex-col space-y-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-black text-slate-800">{selectedInforme.titulo}</h2>
              <div className="flex items-center space-x-4 mt-3 border-t border-slate-100 pt-3">
                 <button onClick={() => setActiveTab('resumen')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>📄 Resumen Ejecutivo</button>
                 <button onClick={() => setActiveTab('hallazgos')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'hallazgos' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>⚠️ Hallazgos ({hInfo.length})</button>
                 <button onClick={() => setActiveTab('planes')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'planes' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✅ Planes ({pInfo.length})</button>
                 <button onClick={() => setActiveTab('firmas')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'firmas' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✍️ Firmas y Actas</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
              {activeTab === 'resumen' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Hallazgos</p><p className="text-3xl font-black text-slate-800">{hInfo.length}</p></div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-red-600 mb-1">Críticos</p><p className="text-3xl font-black text-red-600">{hCrit}</p></div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-blue-700 mb-1">Planes Asignados</p><p className="text-3xl font-black text-blue-700">{pInfo.length}</p></div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Cumplimiento</p><p className="text-3xl font-black text-emerald-600">{avance}%</p></div>
                  </div>
                  <div><h4 className="text-xs font-black uppercase text-slate-800 mb-2 border-b pb-1">Contexto y Alcance</h4><p className="text-sm text-slate-600">El presente informe detalla los resultados de la auditoría ejecutada al proceso de <b>{selectedInforme.proceso}</b>, cuyo objetivo principal fue evaluar la eficacia de los controles y el nivel de exposición al riesgo.</p></div>
                </div>
              )}
              {activeTab === 'hallazgos' && (
                <div className="space-y-4 animate-in fade-in">
                  {hInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay hallazgos registrados.</p> : 
                    hInfo.map((h, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border flex justify-between items-start">
                        <div><span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded">{h.ref}</span><h4 className="text-sm font-bold mt-2">{h.titulo}</h4></div>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${h.severidad==='Crítico'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{h.severidad}</span>
                      </div>
                    ))}
                </div>
              )}
              {activeTab === 'planes' && (
                <div className="space-y-4 animate-in fade-in">
                  {pInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay planes vinculados.</p> : 
                    pInfo.map((p, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border flex items-center justify-between">
                         <div className="flex-1"><p className="text-xs font-bold">{p.accion}</p><p className="text-[10px] text-slate-500 mt-1">Resp: {p.responsable}</p></div>
                         <div className="w-24 text-center border-l pl-4"><p className="text-xl font-black text-blue-600">{p.progreso||0}%</p></div>
                      </div>
                    ))}
                </div>
              )}
              {activeTab === 'firmas' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Elaborado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.elaboradoPor || 'N/A'}</p></div>
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Revisado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.revisadoPor || 'N/A'}</p></div>
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Aprobado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.aprobadoPor || 'N/A'}</p></div>
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
  // VISTA 2: MODO LISTA ORIGINAL (Tu formulario de siempre)
  // ============================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.</p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
          </div>
          <button onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ Archivar, Radicar y Distribuir Nuevo Informe'}</h3>
          <form onSubmit={handleInformeAuditoriaSubmit} key={editInformeAuditoria?.id || 'nuevo-informe-form'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label><input name="titulo" defaultValue={editInformeAuditoria?.titulo||''} required placeholder="Ej: Auditoría de Cumplimiento a Cadena de Suministros" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold text-slate-800" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editInformeAuditoria?.proceso||''} required placeholder="Ej: Compras / Finanzas" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label><input name="fecha" type="date" defaultValue={editInformeAuditoria?.fecha||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            
            <div><label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label><input name="elaboradoPor" defaultValue={editInformeAuditoria?.elaboradoPor||''} required placeholder="Nombre del auditor" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label><input name="revisadoPor" defaultValue={editInformeAuditoria?.revisadoPor||''} required placeholder="Nombre de quien revisó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label><input name="aprobadoPor" defaultValue={editInformeAuditoria?.aprobadoPor||''} required placeholder="Nombre de quien aprobó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label><select name="socializado" defaultValue={editInformeAuditoria?.socializado||'No'} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#004d40] outline-none font-bold"><option>No</option><option>Sí</option></select></div>
            
            <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Líderes y convocados)</label><input name="socializadoCon" defaultValue={editInformeAuditoria?.socializadoCon||''} placeholder="Ej: Comité de Auditoría, Gerencia General, Jefe de Compras..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>

            <div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
              <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 Distribución por Correo Electrónico (Notificación Inmediata)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co (Separa los correos por comas)" className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
              <p className="text-[9px] text-blue-600 mt-1 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

            <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex justify-between items-center border-b pb-2 border-slate-200">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Gestor de Evidencias Digitales</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube los soportes a tu repositorio corporativo institucional y pega sus links públicos.</p>
                </div>
                <div className="flex space-x-2">
                  <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">📁 Drive</a>
                  <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">☁ OneDrive</a>
                </div>
              </div>
              <div>
                <label className="font-black text-slate-700 uppercase tracking-widest text-[10px] block mb-1.5">📄 Link del Informe Final (PDF)</label>
                <input type="url" name="evidenciaUrlInput" defaultValue={editInformeAuditoria?.evidenciaUrl||''} required placeholder="https://drive.google.com/..." className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-[#004d40] outline-none" />
              </div>
              <div>
                <label className="font-black text-purple-800 uppercase tracking-widest text-[10px] block mb-1.5">🤝 Link del Acta de Socialización</label>
                <input type="url" name="actaSocializacionUrlInput" defaultValue={editInformeAuditoria?.actaSocializacionUrl||''} placeholder="https://drive.google.com/..." className="w-full border border-purple-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#004d40] hover:bg-[#003d33] text-white cursor-pointer'}`}>
                {isSubmitting ? '⏳ Procesando...' : (editInformeAuditoria ? 'Guardar Cambios' : 'Radicar, Archivar y Enviar Dictamen')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-4 w-28">
                <div>Consecutivo</div>
                <FilterInput colKey="ref" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-4">
                <div>Proceso / Título</div>
                <FilterInput colKey="proceso" placeholder="Filtrar Proceso..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-4">Trazabilidad de Firmas</th>
              <th className="p-4">Socialización e Impacto</th>
              <th className="p-4 text-center">Documentos Custodiados</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700 bg-white">
            {applyFilters(safeInformes, searchTerm, columnFilters).map((inf, idx) => (
              <tr key={`inf-row-${inf.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">{inf.ref || `INF-2026-${String(idx+1).padStart(3, '0')}`}</td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
                  <div className="font-bold text-slate-900 text-sm">{inf.titulo}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                </td>
                <td className="p-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                    <div><span className="text-slate-400 font-bold">✍ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                    <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                    <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${inf.socializado === 'Sí' ? 'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado}</span>
                  <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>
                </td>
                
                {/* BOTONERA ACTUALIZADA */}
                <td className="p-4 text-center space-y-1.5">
                  <button onClick={() => abrirCentroEjecutivo(inf)} className="bg-slate-800 text-white font-black px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 flex items-center justify-center space-x-1 border border-slate-700 shadow-md transition-all w-full mb-2">
                    <span className="text-sm">📊</span><span>Centro Ejecutivo y PDF</span>
                  </button>

                  <a href={inf.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full">
                    <span>📄</span><span>Ver Informe Final</span>
                  </a>
                  {inf.actaSocializacionUrl ? (
                    <a href={inf.actaSocializacionUrl} target="_blank" rel="noreferrer" className="bg-purple-50 text-purple-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full">
                      <span>🤝</span><span>Ver Acta Socialización</span>
                    </a>
                  ) : (
                    <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1 rounded border border-dashed text-center">Sin Acta Cargada</div>
                  )}
                  {isAdmin && (
                    <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                      <button onClick={() => {setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏ Editar</button>
                      <span className="text-slate-200">|</span>
                      <button onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑 Eliminar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}