// scripts/catalogoEjemplo.js - Apartados 12 (interesados) y 14 (organigrama) del proyecto "Ejemplo" con los
// cargos y organizaciones del catálogo de Cargos y Procesos, tal como están escritos en la plataforma.
import { buscarEnCatalogo } from '../src/utils/proyectos/catalogos.js';

// Cargos candidatos por papel, en orden de preferencia (nombres del catálogo base de la empresa).
const CARGOS = {
  gerencia: ['GERENTE GENERAL'],
  director: ['JEFE DE CONTROL INTERNO'],
  operaciones: ['COORDINADOR DE OPERACIONES', 'Coordinador Operaciones', 'SUBDIRECCIÓN DE OPERACIONES BALNEARIO'],
  juridica: ['Gerente Administrativa y Judicial', 'DIRECTORA ADMINISTRATIVA Y FINANCIERA', 'DIRECTOR ADMINISTRATIVO Y FINANCIERO'],
};
// Organizaciones externas del ejemplo: la autoridad ambiental es real; la junta y el contratista son de ejemplo.
export const ORGANIZACIONES_EJEMPLO = {
  autoridad: 'Corporación Autónoma Regional de Risaralda (CARDER)',
  comunidad: 'Junta de Acción Comunal de la vereda (ejemplo)',
  contratista: 'Contratista de obra del sendero (ejemplo)',
};

export function ajustarEjemploACatalogo({ cargos = [], organizaciones = [] } = {}) {
  const faltan = [];
  const cargo = papel => {
    const encontrado = CARGOS[papel].map(nombre => buscarEnCatalogo(nombre, cargos)).find(Boolean);
    if (!encontrado) faltan.push(`cargo ${CARGOS[papel][0]}`);
    return encontrado || CARGOS[papel][0];
  };
  const organizacion = clave => {
    const encontrada = buscarEnCatalogo(ORGANIZACIONES_EJEMPLO[clave], organizaciones);
    if (!encontrada) faltan.push(`organización ${ORGANIZACIONES_EJEMPLO[clave]}`);
    return encontrada || ORGANIZACIONES_EJEMPLO[clave];
  };
  const interesados = { lista: [
    { nombre: cargo('gerencia'), tipo: 'interno', poder: 5, interes: 4, actitud: 'favor', expectativas: 'Retorno de la inversión en menos de 2 años y posicionamiento en turismo de naturaleza.', mensajes: 'Avance contra el cronograma, VAN y recuperación actualizados.', canal: 'Comité mensual', frecuencia: 'Mensual', responsable: cargo('director') },
    { nombre: organizacion('comunidad'), contacto: 'Presidente de la junta', tipo: 'externo', poder: 4, interes: 5, actitud: 'neutral', expectativas: 'Empleo local y cuidado del bosque.', mensajes: 'Vinculación de guías de la vereda y plan de manejo ambiental.', riesgosAsociados: 'Oposición si no se contrata personal local.', canal: 'Reunión', frecuencia: 'Mensual', responsable: cargo('operaciones') },
    { nombre: cargo('operaciones'), tipo: 'interno', poder: 3, interes: 5, actitud: 'favor', expectativas: 'Operación simple y segura del recorrido.', canal: 'Correo', frecuencia: 'Quincenal', responsable: cargo('director') },
    { nombre: organizacion('autoridad'), contacto: 'Subdirección de gestión ambiental', tipo: 'externo', poder: 5, interes: 2, actitud: 'neutral', expectativas: 'Cumplimiento de la normativa ambiental en el bosque.', riesgosAsociados: 'Demora en el permiso de intervención.', canal: 'Oficio', frecuencia: 'Por trámite', responsable: cargo('juridica') },
  ] };
  const organigrama = { roles: [
    { fase: 'preinversion', rol: 'Aprobación de la factibilidad', origen: 'empresa', persona: cargo('juridica'), nivel: 'estrategico' },
    { fase: 'inversion', rol: 'Patrocinador', origen: 'empresa', persona: cargo('gerencia'), nivel: 'estrategico' },
    { fase: 'inversion', rol: 'Director del proyecto', origen: 'empresa', persona: cargo('director'), reportaA: 'Patrocinador', nivel: 'tactico', funciones: 'Planificar, controlar y reportar' },
    { fase: 'inversion', rol: 'Residente de obra', origen: 'externa', organizacion: organizacion('contratista'), persona: 'Ingeniero residente', reportaA: 'Director del proyecto', nivel: 'operativo' },
    { fase: 'operacion', rol: 'Coordinador de experiencias', origen: 'empresa', persona: cargo('operaciones'), nivel: 'tactico' },
  ] };
  return { interesados, organigrama, faltan };
}
