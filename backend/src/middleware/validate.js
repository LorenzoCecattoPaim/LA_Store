const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Dados inválidos.',
      fields: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor.' : err.message
  });
};

const notFound = (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
};

module.exports = { validate, errorHandler, notFound };
