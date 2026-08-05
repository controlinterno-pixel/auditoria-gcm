/**
 * @file server.js
 * @description Servidor Express principal para la plataforma GRC.
 */

import express from 'express';
import cors from 'cors';
import auditRoutes from './routes/auditRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rutas
app.use('/api/v1/audit', auditRoutes);

// Endpoint de verificación de estado
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'GRC Audit Engine API',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor GRC API corriendo en: http://localhost:${PORT}`);
  console.log(`📌 Endpoint activo: POST http://localhost:${PORT}/api/v1/audit/query\n`);
});