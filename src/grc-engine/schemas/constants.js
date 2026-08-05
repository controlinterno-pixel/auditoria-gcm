/**
 * @file constants.js
 * @description Constantes estandarizadas para el motor GRC.
 * Evita la dependencia directa de strings libres y facilita la i18n/escalabilidad.
 */

export const ImpactLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const PriorityLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

export const TrendDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
  STABLE: 'STABLE'
};

export const ActionIntent = {
  ANALYZE: 'ANALYZE',
  EVALUATE: 'EVALUATE',
  QUERY: 'QUERY',
  SIMULATE: 'SIMULATE',
  AUDIT: 'AUDIT'
};