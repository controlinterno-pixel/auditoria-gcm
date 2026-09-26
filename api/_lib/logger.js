// api/_lib/logger.js - Logger JSON Estructurado para Vercel Serverless
export const logger = {
  info: (mensaje, meta = {}) => {
    console.log(
      JSON.stringify({
        nivel: 'INFO',
        timestamp: new Date().toISOString(),
        mensaje,
        ...meta
      })
    );
  },

  warn: (mensaje, meta = {}) => {
    console.warn(
      JSON.stringify({
        nivel: 'WARN',
        timestamp: new Date().toISOString(),
        mensaje,
        ...meta
      })
    );
  },

  error: (mensaje, error = null, meta = {}) => {
    console.error(
      JSON.stringify({
        nivel: 'ERROR',
        timestamp: new Date().toISOString(),
        mensaje,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            }
          : null,
        ...meta
      })
    );
  }
};