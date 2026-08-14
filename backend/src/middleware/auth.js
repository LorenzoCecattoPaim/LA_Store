const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido.' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, active')
      .eq('id', decoded.id)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    if (!user.active)   return res.status(403).json({ error: 'Conta desativada.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado.' });
    return res.status(401).json({ error: 'Token inválido.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { data: user } = await supabase
        .from('users').select('id,name,email,role').eq('id', decoded.id).single();
      req.user = user || null;
    }
  } catch {}
  next();
};

module.exports = { auth, adminOnly, optionalAuth };
