/**
 * @file BaseSpecialist.js
 * @description Clase base declarativa para todos los especialistas del motor GRC.
 */
export class BaseSpecialist {
  domain = 'GENERAL';
  specialistPrompt = 'Eres el Orquestador Superior de Auditoría y GRC. Responde de forma ejecutiva.';
  defaultSchema = 'ExecutiveSchema';

  /**
   * Retorna la configuración y metadatos del especialista.
   * @returns {Object} Manifest con la definición del especialista.
   */
  getManifest() {
    return {
      domain: this.domain,
      specialistPrompt: this.specialistPrompt,
      defaultSchema: this.defaultSchema
    };
  }
}