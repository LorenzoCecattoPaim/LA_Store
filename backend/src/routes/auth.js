const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { body } = require('express-validator');
const supabase  = require('../config/supabase');
const mailer    = require('../utils/mailer');
const { auth }  = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const crypto = require('crypto');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

router.post('/register',
  body('name').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
  validate,
  async (req, res, next) => {
    try {
      console.log('=== INÍCIO DO CADASTRO ===');
      console.log('Body recebido:', req.body);

      const { name, email, password, phone } = req.body;

      console.log('1 - Verificando se usuário já existe');

      const { data: existing, error: existingError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      console.log('Resultado verificação:', {
        existing,
        existingError
      });

      if (existingError) {
        console.error('ERRO NA CONSULTA:', existingError);
        throw existingError;
      }

      if (existing) {
        return res.status(409).json({
          error: 'E-mail já cadastrado.'
        });
      }

      console.log('2 - Gerando hash da senha');

      const hash = await bcrypt.hash(password, 12);

      console.log('3 - Inserindo usuário');

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          name,
          email,
          password: hash,
          phone: phone || null,
          role: 'customer'
        })
        .select('id,name,email,role')
        .single();

      console.log('Resultado insert:', {
        user,
        error
      });

      if (error) {
        console.error('SUPABASE INSERT ERROR:', error);
        throw error;
      }

      console.log('4 - Usuário criado com sucesso');
      console.log('JWT configurado?', !!process.env.JWT_SECRET);

      // Desabilitado temporariamente para teste
      // mailer.sendWelcome({ to: email, name }).catch(() => {});

      const token = signToken(user.id);

      console.log('5 - Token gerado');

      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });

      console.log('=== FIM DO CADASTRO ===');

    } catch (err) {
      console.error('=== ERRO NO CADASTRO ===');
      console.error(err);
      console.error(err.stack);
      console.error('========================');

      next(err);
    }
  }
);

/* POST /api/auth/register 
router.post('/register',
  body('name').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, phone } = req.body;

      const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
      if (existing) return res.status(409).json({ error: 'E-mail já cadastrado.' });

      const hash = await bcrypt.hash(password, 12);
      const { data: user, error } = await supabase
        .from('users')
        .insert({ name, email, password: hash, phone: phone || null, role: 'customer' })
        .select('id,name,email,role')
        .single();

      if (error) throw error;

      mailer.sendWelcome({ to: email, name }).catch(() => {});

      res.status(201).json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { next(err); }
  }
);*/

/* POST /api/auth/login */
router.post('/login',
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').notEmpty().withMessage('Senha obrigatória'),
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const { data: user } = await supabase
        .from('users').select('id,name,email,password,role,active').eq('email', email).single();

      if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
      if (!user.active) return res.status(403).json({ error: 'Conta desativada.' });

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });

      res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { next(err); }
  }
);

/* GET /api/auth/me */
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

/* PUT /api/auth/profile */
router.put('/profile', auth,
  body('name').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone } = req.body;
      const updates = { name, email, phone: phone || null };

      if (req.body.password) {
        if (req.body.password.length < 8) return res.status(422).json({ error: 'Senha deve ter no mínimo 8 caracteres.' });
        updates.password = await bcrypt.hash(req.body.password, 12);
      }

      const { data: user, error } = await supabase
        .from('users').update(updates).eq('id', req.user.id).select('id,name,email,role').single();

      if (error) throw error;
      res.json({ user });
    } catch (err) { next(err); }
  }
);

/* POST /api/auth/forgot-password */
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  validate,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const { data: user } = await supabase.from('users').select('id,name').eq('email', email).single();

      // Sempre retorna 200 para não expor e-mails cadastrados
      if (!user) return res.json({ message: 'Se o e-mail existir, enviaremos as instruções.' });

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000).toISOString();

      await supabase.from('users').update({
        reset_token: token,
        reset_token_expires: expires
      }).eq('id', user.id);

      const resetUrl = `${process.env.FRONTEND_URL}/redefinir-senha?token=${token}`;
      mailer.sendPasswordReset({ to: email, name: user.name, resetUrl }).catch(() => {});

      res.json({ message: 'Se o e-mail existir, enviaremos as instruções.' });
    } catch (err) { next(err); }
  }
);

/* POST /api/auth/reset-password */
router.post('/reset-password',
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  validate,
  async (req, res, next) => {
    try {
      const { token, password } = req.body;
      const { data: user } = await supabase
        .from('users')
        .select('id,reset_token_expires')
        .eq('reset_token', token)
        .single();

      if (!user || new Date(user.reset_token_expires) < new Date()) {
        return res.status(400).json({ error: 'Token inválido ou expirado.' });
      }

      const hash = await bcrypt.hash(password, 12);
      await supabase.from('users').update({ password: hash, reset_token: null, reset_token_expires: null }).eq('id', user.id);

      res.json({ message: 'Senha redefinida com sucesso.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
