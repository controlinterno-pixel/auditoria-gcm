// tests/proyectosGuias.test.js - Cada casilla de los formularios de Gestión de Proyectos tiene su ayuda
// (qué, cómo, por qué) con la referencia al manual E-ID-MAN-01 o la aclaración de que no lo exige.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buscarGuia } from '../src/components/proyectos/guias.js';

// Archivo → formularios (contextos) que contiene.
const FORMULARIOS = {
  'FormularioProyecto.jsx': ['ficha'],
  'FormularioTarea.jsx': ['tarea'],
  'RiesgosProyecto.jsx': ['riesgo'],
  'EntregablesProyecto.jsx': ['entregable'],
  'CambiosProyecto.jsx': ['cambio'],
  'ReunionesProyecto.jsx': ['reunion'],
  'PresupuestoProyecto.jsx': ['costo', 'presupuesto'],
  'AgilProyecto.jsx': ['sprint'],
  'FormulacionProyecto.jsx': ['alternativas', 'entorno', 'aspectos', 'cronogramaFases', 'objetivos', 'pestel', 'propuestaValor', 'modeloNegocio', 'ingresos', 'localizacion', 'ingenieria', 'organizacional', 'financiero'],
  'PlanificacionProyecto.jsx': ['interesados', 'organigrama', 'raci'],
  'CierreProyecto.jsx': ['transferencia', 'lecciones', 'actaCierre'],
};
// Casillas que se arman con datos del proyecto (bloques del CANVA, fases) y se revisan aparte.
const ETIQUETAS_DINAMICAS = /\$\{/;
// Textos que el patrón encuentra pero no son casillas (estados, títulos de grupo, nombres de impacto).
const NO_SON_CASILLAS = new Set(['Aprobación de fases', 'planificacion', 'administrador', 'historia', 'en_revision', 'rechazado', 'cancelada', 'cancelado', 'epica',
  'Alcance', 'Tiempo', 'Costo', 'Calidad', 'Riesgos', 'Prefactibilidad · Formato 1 · Estructura inicial', 'Factibilidad · Formato 2 · Formulación del proyecto']);

function etiquetas(archivo) {
  const fuente = readFileSync(new URL(`../src/components/proyectos/${archivo}`, import.meta.url), 'utf8');
  const encontradas = [
    ...fuente.matchAll(/etiqueta="([^"]+)"/g),
    ...fuente.matchAll(/etiqueta=\{`([^`]+)`\}/g),
    ...fuente.matchAll(/campo(?:Texto|Correo)\('[a-zA-Z]+', '([^']+)'/g),
    ...fuente.matchAll(/\['[a-zA-Z]+', '([^']+)'\]/g),
  ].map(coincidencia => coincidencia[1]);
  return [...new Set(encontradas)].filter(etiqueta => !NO_SON_CASILLAS.has(etiqueta));
}

test('todas las casillas de los formularios tienen ayuda', () => {
  const faltantes = Object.entries(FORMULARIOS).flatMap(([archivo, contextos]) => etiquetas(archivo)
    .filter(etiqueta => !ETIQUETAS_DINAMICAS.test(etiqueta) || /Precio promedio|Monto|Impacto en/.test(etiqueta))
    .map(etiqueta => etiqueta.replace(/\$\{[^}]+\}/g, '').replace(/ \($/, ''))
    .filter(etiqueta => !contextos.some(contexto => buscarGuia(contexto, etiqueta) || (etiqueta.startsWith('Impacto en') && buscarGuia(contexto, 'Impacto en alcance'))))
    .map(etiqueta => `${archivo}: "${etiqueta}"`));
  assert.deepEqual(faltantes, []);
});

test('cada ayuda dice qué, cómo, por qué y dónde (o que el manual no lo exige)', () => {
  const guia = buscarGuia('ficha', 'Problema u oportunidad que atiende (apartado 1 del manual)');
  assert.match(guia.manual, /E-ID-MAN-01, numeral 4\.1\.2\.1 · Apartado 1 .*\(pág\. 8\)/);
  assert.ok(guia.que && guia.como && guia.porque);
  assert.match(buscarGuia('ficha', 'Calendario del cronograma').manual, /No lo exige el manual/);
  // La misma etiqueta tiene ayuda distinta según el formulario.
  assert.notEqual(buscarGuia('tarea', 'Estado').como, buscarGuia('riesgo', 'Estado').como);
  assert.equal(buscarGuia('filtro', 'Área'), null, 'los filtros no muestran ayudas del manual');
});
