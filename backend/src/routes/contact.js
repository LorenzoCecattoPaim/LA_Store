const router = require('express').Router();
const { body } = require('express-validator');
const mailer   = require('../utils/mailer');
const { validate } = require('../middleware/validate');

/* POST /api/contact */
router.post('/',
  body('name').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('subject').trim().notEmpty().withMessage('Assunto obrigatório'),
  body('message').trim().isLength({ min: 10 }).withMessage('Mensagem muito curta'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, subject, message } = req.body;
      await mailer.sendContactMessage({ name, email, subject, message });
      res.json({ message: 'Mensagem enviada com sucesso!' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
