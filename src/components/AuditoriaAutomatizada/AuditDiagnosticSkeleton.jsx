// Ruta: src/components/AuditoriaAutomatizada/AuditDiagnosticSkeleton.jsx
import React from 'react';

export const AuditDiagnosticSkeleton = () => {
  return (
    <div className="w-full space-y-6 animate-pulse p-2">
      {/* Cabecera Skeleton */}
      <div className="bg-slate-800/60 h-28 rounded-2xl border border-slate-700/40 p-4 space-y-3">
        <div className="h-4 bg-slate-700/80 rounded w-1/4"></div>
        <div className="h-6 bg-slate-700/80 rounded w-2/3"></div>
      </div>

      {/* KPIs Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800/60 h-24 rounded-2xl border border-slate-700/40 p-4 space-y-2">
            <div className="h-3 bg-slate-700/80 rounded w-1/2"></div>
            <div className="h-8 bg-slate-700/80 rounded w-1/3"></div>
          </div>
        ))}
      </div>

      {/* Heatmap Skeleton */}
      <div className="bg-slate-800/60 h-56 rounded-2xl border border-slate-700/40 p-4"></div>
    </div>
  );
};