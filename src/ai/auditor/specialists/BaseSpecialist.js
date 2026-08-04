/**
 * @file BaseSpecialist.js
 * @description Clase base declarativa para todos los especialistas del motor GRC.
 */

export class BaseSpecialist {
  domain = 'GENERAL';
  specialistPrompt = '';
  defaultSchema = 'executive';

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