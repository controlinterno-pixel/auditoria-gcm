// api/_lib/responseHelper.js - Helper de Respuestas Estándar REST
export const sendSuccess = (res, data = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...data
  });
};

export const sendError = (res, message = 'Error interno del servidor', status = 500) => {
  return res.status(status).json({
    success: false,
    error: message
  });
};