/**
 * @file auditRoutes.js
 * @description Definición de rutas HTTP para la API de Auditoría.
 */

import { Router } from 'express';
import { processQuery } from '../controllers/auditController.js';

const router = Router();

// Endpoint principal para realizar consultas al motor
router.post('/query', processQuery);

// Esta línea es crucial para evitar el SyntaxError:
export default router;