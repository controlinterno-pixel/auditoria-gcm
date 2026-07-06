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
  // 🖨️ MOTOR PDF GRÁFICO AVANZADO (ARTESANÍA INLINE CSS)
  // ============================================================================
  const generarPDFEjecutivo = async () => {
    if (!selectedInforme) return;
    setIsGeneratingPdf(true);

    try {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = resolve; document.head.appendChild(script);
        });
      }
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve; document.head.appendChild(script);
        });
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'letter');
      
      // Capturamos las 4 páginas que hemos diseñado
      const paginas = ['pdf-pag-1', 'pdf-pag-2', 'pdf-pag-3', 'pdf-pag-4'];
      
      for (let i = 0; i < paginas.length; i++) {
        const pageElement = document.getElementById(paginas[i]);
        if (!pageElement) continue;

        // Obligamos al navegador a tomar una foto HD
        const canvas = await window.html2canvas(pageElement, { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff' 
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdfWidth = 215.9; // mm
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`Informe_${selectedInforme.ref}.pdf`);
      
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Hubo un error al compilar el PDF. Verifica la consola.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (viewMode === 'executive' && selectedInforme) {
    const hInfo = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
    const hCrit = hInfo.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
    const idsH = hInfo.map(h => h.id);
    const pInfo = safePlanes.filter(p => idsH.includes(p.idHallazgo));
    const avance = pInfo.length > 0 ? Math.round(pInfo.reduce((a, b) => a + (b.progreso||0), 0) / pInfo.length) : 0;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 relative">
        
        {/* ====================================================================
            🎨 PLANTILLA HTML OCULTA (CSS PURO, 0% TAILWIND)
        ===================================================================== */}
        <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', zIndex: -100 }}>
          
{/* --- PÁGINA 1: PORTADA EXACTA A LA MAQUETA --- */}
          <div id="pdf-pag-1" style={{ width: '816px', height: '1056px', backgroundColor: '#ffffff', display: 'flex', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', position: 'relative' }}>
            
            {/* PANEL IZQUIERDO BLANCO */}
            <div style={{ width: '330px', height: '100%', backgroundColor: '#ffffff', padding: '60px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
              
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '80px' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#042f2e', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', color: 'white' }}>💧</div>
                <div style={{ marginLeft: '12px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '900', margin: '0', color: '#042f2e', lineHeight: '1' }}>TERMALES</h1>
                  <p style={{ fontSize: '10px', margin: '0', color: '#475569', fontWeight: 'bold' }}>Santa Rosa de Cabal</p>
                </div>
              </div>

              {/* Títulos */}
              <div style={{ marginBottom: '60px' }}>
                <p style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px', color: '#059669', textTransform: 'uppercase' }}>Centro de Mando GRC</p>
                <h2 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 10px 0', lineHeight: '1.1', color: '#042f2e' }}>INFORME DE<br/>AUDITORÍA</h2>
                <h3 style={{ fontSize: '24px', fontWeight: '900', margin: '0', color: '#059669' }}>{selectedInforme.ref}</h3>
                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginTop: '10px' }}>{selectedInforme.proceso}</p>
              </div>

              {/* Metadatos (Iconos y Textos) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                  <div style={{ fontSize: '20px', marginTop: '-2px' }}>📅</div>
                  <div>
                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Fecha de Emisión</p>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0', color: '#0f172a' }}>{formatSafeDate(selectedInforme.fecha)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                  <div style={{ fontSize: '20px', marginTop: '-2px' }}>👤</div>
                  <div>
                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Auditor Responsable</p>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0', color: '#0f172a' }}>{selectedInforme.elaboradoPor}</p>
                    <p style={{ fontSize: '10px', margin: '2px 0 0 0', color: '#64748b' }}>Auditor Líder</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                   <div style={{ fontSize: '20px', marginTop: '-2px' }}>✅</div>
                   <div>
                     <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Estado</p>
                     <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0', color: '#0f172a' }}>{selectedInforme.socializado === 'Sí' ? 'EMITIDO Y SOCIALIZADO' : 'INFORME EMITIDO'}</p>
                   </div>
                </div>
              </div>
            </div>

            {/* PANEL DERECHO CON IMAGEN CASCADA Y CURVA SVG */}
            <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
              
              {/* Contenedor de la imagen (apunta a tu carpeta public/cascada.jpg) */}
              <img src="/cascada.jpg" alt="Fondo Cascada" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
              
              {/* Filtro oscuro elegante sobre la foto */}
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4, 47, 46, 0.4)', zIndex: 2 }}></div>

              {/* Título superpuesto en la foto */}
              <div style={{ position: 'absolute', zIndex: 3, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '85%' }}>
                 <h1 style={{ fontSize: '42px', fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', lineHeight: '1.2', margin: '0', textShadow: '2px 2px 8px rgba(0,0,0,0.6)' }}>{selectedInforme.titulo}</h1>
                 <div style={{ width: '80px', height: '6px', backgroundColor: '#10b981', margin: '24px auto 0', borderRadius: '3px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}></div>
              </div>

              {/* CURVA SVG BLANCA (Para fusionar el panel izquierdo y derecho suavemente) */}
              <svg style={{ position: 'absolute', left: '-2px', top: '-10%', height: '120%', width: '150px', zIndex: 5 }} preserveAspectRatio="none" viewBox="0 0 100 100">
                 <path d="M0,0 Q100,50 0,100 Z" fill="#ffffff" />
              </svg>
            </div>

            {/* BARRA VERDE INFERIOR (FOOTER DE PORTADA) */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '50px', backgroundColor: '#042f2e', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 40px', boxSizing: 'border-box' }}>
               <p style={{ color: '#ffffff', fontSize: '11px', margin: 0, fontWeight: 'bold' }}>🛡️ Integridad • Transparencia • Excelencia</p>
            </div>
          </div>          

          {/* --- PÁGINA 2: RESUMEN EJECUTIVO --- */}
          <div id="pdf-pag-2" style={{ width: '816px', height: '1056px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', padding: '50px', boxSizing: 'border-box' }}>
            {/* Header Página */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #042f2e', paddingBottom: '15px', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#042f2e', margin: '0', letterSpacing: '1px' }}>2 | RESUMEN EJECUTIVO</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#042f2e', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>💧</div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>TERMALES</span>
              </div>
            </div>

            {/* Objetivo y Alcance */}
            <div style={{ display: 'flex', gap: '30px', marginBottom: '30px' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>Objetivo</h3>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0', textAlign: 'justify' }}>{selectedInforme.objetivo}</p>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>Alcance</h3>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0', textAlign: 'justify' }}>{selectedInforme.alcance}</p>
              </div>
            </div>

            {/* KPIs (4 Cajas) */}
            <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px', textTransform: 'uppercase' }}>Indicadores Clave</h3>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Hallazgos Identificados</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>{hInfo.length}</p>
              </div>
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', textAlign: 'center', borderTop: '4px solid #ef4444' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Hallazgos Críticos</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444', margin: '0' }}>{hCrit}</p>
              </div>
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', textAlign: 'center', borderTop: '4px solid #10b981' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Cumplimiento Global</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981', margin: '0' }}>{avance}%</p>
              </div>
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Planes en Ejecución</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>{pInfo.length}</p>
              </div>
            </div>

            {/* Conclusión General */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>Conclusión General</h3>
              <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{selectedInforme.conclusion || 'Sin conclusión redactada.'}</p>
            </div>
          </div>

          {/* --- PÁGINA 3: HALLAZGOS --- */}
          <div id="pdf-pag-3" style={{ width: '816px', height: '1056px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', padding: '50px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #042f2e', paddingBottom: '15px', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#042f2e', margin: '0', letterSpacing: '1px' }}>3 | HALLAZGOS IDENTIFICADOS</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#042f2e', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>💧</div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>TERMALES</span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 0', textAlign: 'left', width: '15%', color: '#0f172a' }}>ID</th>
                  <th style={{ padding: '10px 0', textAlign: 'left', width: '65%', color: '#0f172a' }}>DESCRIPCIÓN DEL HALLAZGO</th>
                  <th style={{ padding: '10px 0', textAlign: 'center', width: '20%', color: '#0f172a' }}>CRITICIDAD</th>
                </tr>
              </thead>
              <tbody>
                {hInfo.slice(0, 15).map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 0', fontWeight: 'bold', color: '#475569' }}>{h.ref}</td>
                    <td style={{ padding: '12px 10px 12px 0', color: '#334155' }}>{h.titulo}</td>
                    <td style={{ padding: '12px 0', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase',
                        backgroundColor: h.severidad === 'Crítico' ? '#dc2626' : h.severidad === 'Alto' ? '#ea580c' : '#10b981' 
                      }}>
                        {h.severidad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- PÁGINA 4: MATRIZ DE RIESGOS --- */}
          <div id="pdf-pag-4" style={{ width: '816px', height: '1056px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', padding: '50px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #042f2e', paddingBottom: '15px', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#042f2e', margin: '0', letterSpacing: '1px' }}>4 | MATRIZ DE RIESGOS</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#042f2e', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>💧</div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>TERMALES</span>
              </div>
            </div>

            <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '20px', textTransform: 'uppercase' }}>Mapa de Calor (Probabilidad vs Impacto)</h3>
            
            {/* Dibujo de la Matriz 5x5 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '50px' }}>
               <div style={{ transform: 'rotate(-90deg)', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', marginRight: '10px' }}>PROBABILIDAD</div>
               
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {[5,4,3,2,1].map((y) => (
                   <div key={`y-${y}`} style={{ display: 'flex' }}>
                     <div style={{ width: '60px', paddingRight: '10px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '10px', color: '#64748b' }}>
                        {y === 5 ? 'Casi Seguro' : y === 4 ? 'Probable' : y === 3 ? 'Posible' : y === 2 ? 'Improbable' : 'Rara Vez'}
                     </div>
                     {[1,2,3,4,5].map((x) => {
                        const score = x * y;
                        let bg = '#10b981'; // Verde
                        if (score >= 6) bg = '#eab308'; // Amarillo
                        if (score >= 10) bg = '#f97316'; // Naranja
                        if (score >= 16) bg = '#ef4444'; // Rojo

                        return (
                          <div key={`x-${x}-y-${y}`} style={{ width: '80px', height: '60px', backgroundColor: bg, border: '1px solid #ffffff' }}></div>
                        )
                     })}
                   </div>
                 ))}
                 <div style={{ display: 'flex', marginLeft: '60px', marginTop: '10px' }}>
                    {['Insignif.', 'Menor', 'Moderado', 'Mayor', 'Catastróf.'].map((lbl, idx) => (
                      <div key={idx} style={{ width: '80px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>{lbl}</div>
                    ))}
                 </div>
                 <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', marginTop: '15px', marginLeft: '60px' }}>IMPACTO</div>
               </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>Fortalezas Observadas</h3>
              <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{selectedInforme.fortalezas || 'Sin fortalezas redactadas.'}</p>
            </div>

          </div>

        </div>
        {/* ====================================================================
            FIN DE PLANTILLA OCULTA
        ===================================================================== */}

        {/* ---------------- VISTA EN PANTALLA PARA EL USUARIO ---------------- */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setViewMode('list')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center space-x-2 transition-colors">
            <span>←</span> <span>Volver a Formulario de Registro</span>
          </button>
          <div className="flex space-x-3">
            <button onClick={generarPDFEjecutivo} disabled={isGeneratingPdf} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-md transition-all">
              <span>{isGeneratingPdf ? '⏳' : '📥'}</span> <span>{isGeneratingPdf ? 'Construyendo Documento HD...' : 'Descargar PDF Ejecutivo'}</span>
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
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 mb-2 border-b pb-1">Conclusión General</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedInforme.conclusion || 'No se redactó una conclusión para este informe.'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 mb-2 border-b pb-1">Fortalezas Observadas</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedInforme.fortalezas || 'No se detallaron fortalezas.'}</p>
                  </div>
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
  // VISTA 2: FORMULARIO ORIGINAL
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
            <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0A3B32] w-64 shadow-sm" />
          </div>
          <button onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ Archivar, Radicar y Distribuir Nuevo Informe'}</h3>
          <form onSubmit={handleInformeAuditoriaSubmit} key={editInformeAuditoria?.id || 'nuevo-informe-form'} className="space-y-6 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label><input name="titulo" defaultValue={editInformeAuditoria?.titulo||''} required placeholder="Ej: Auditoría de Cumplimiento..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editInformeAuditoria?.proceso||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label><input name="fecha" type="date" defaultValue={editInformeAuditoria?.fecha||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              
              <div><label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label><input name="elaboradoPor" defaultValue={editInformeAuditoria?.elaboradoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label><input name="revisadoPor" defaultValue={editInformeAuditoria?.revisadoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label><input name="aprobadoPor" defaultValue={editInformeAuditoria?.aprobadoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label><select name="socializado" defaultValue={editInformeAuditoria?.socializado||'No'} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold"><option>No</option><option>Sí</option></select></div>
              <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Líderes y convocados)</label><input name="socializadoCon" defaultValue={editInformeAuditoria?.socializadoCon||''} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
            </div>

            {/* 📝 NUEVA SECCIÓN EDITORIAL */}
            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <h4 className="font-black text-emerald-800 uppercase tracking-widest text-[10px] mb-4">📖 Textos Editoriales (Se imprimirán en el PDF)</h4>
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Objetivo de la Auditoría</label>
                <textarea name="objetivo" rows="2" defaultValue={editInformeAuditoria?.objetivo||'Evaluar la eficacia de los controles tecnológicos, la seguridad de la información y la gestión de riesgos...'} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Alcance y Periodo</label>
                <textarea name="alcance" rows="2" defaultValue={editInformeAuditoria?.alcance||'La auditoría cubre los procesos y sistemas desde el 01 de Enero al 30 de Junio de 2026...'} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Conclusión General (Dictamen)</label>
                <textarea name="conclusion" rows="4" defaultValue={editInformeAuditoria?.conclusion||''} placeholder="Luego del análisis realizado, se concluye que..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Fortalezas Observadas</label>
                <textarea name="fortalezas" rows="4" defaultValue={editInformeAuditoria?.fortalezas||''} placeholder="1. Buena disposición de los auditados.&#10;2. Infraestructura al día..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            </div>

            {/* 📸 NUEVA SECCIÓN DE GALERÍA DE IMÁGENES */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <h4 className="font-black text-slate-700 uppercase tracking-widest text-[10px] mb-1">📸 Galería Fotográfica / Evidencias (Página 6 del PDF)</h4>
              <p className="text-[9px] text-slate-500 mb-4">Pega los enlaces directos a las imágenes (ej. Google Drive, Imgur, OneDrive) que documenten los hallazgos principales.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 1 (URL)</label>
                  <input name="img1Url" type="url" defaultValue={editInformeAuditoria?.img1Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img1Desc" type="text" defaultValue={editInformeAuditoria?.img1Desc||''} placeholder="Descripción foto 1..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 2 (URL)</label>
                  <input name="img2Url" type="url" defaultValue={editInformeAuditoria?.img2Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img2Desc" type="text" defaultValue={editInformeAuditoria?.img2Desc||''} placeholder="Descripción foto 2..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 3 (URL)</label>
                  <input name="img3Url" type="url" defaultValue={editInformeAuditoria?.img3Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img3Desc" type="text" defaultValue={editInformeAuditoria?.img3Desc||''} placeholder="Descripción foto 3..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 4 (URL)</label>
                  <input name="img4Url" type="url" defaultValue={editInformeAuditoria?.img4Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img4Desc" type="text" defaultValue={editInformeAuditoria?.img4Desc||''} placeholder="Descripción foto 4..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
              <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 Distribución por Correo Electrónico (Notificación Inmediata)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co" className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] text-white cursor-pointer'}`}>
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
              <th className="p-4 w-28">Consecutivo</th>
              <th className="p-4">Proceso / Título</th>
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
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
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
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado}</span>
                </td>
                
                <td className="p-4 text-center space-y-1.5">
                  <button onClick={() => abrirCentroEjecutivo(inf)} className="bg-slate-800 text-white font-black px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 flex items-center justify-center space-x-1 border border-slate-700 shadow-md transition-all w-full mb-2">
                    <span className="text-sm">📊</span><span>Centro Ejecutivo y PDF</span>
                  </button>

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