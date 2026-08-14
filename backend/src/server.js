require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes   = require('./routes/orders');
const contactRoutes = require('./routes/contact');
const imageRoutes   = require('./routes/images');
const launchRoutes  = require('./routes/launches');
const stockNotificationRoutes = require('./routes/stockNotifications');
const { couponRouter, newsletterRouter, addressRouter, adminRouter, paymentRouter } = require('./routes/extra');
const { errorHandler, notFound } = require('./middleware/validate');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ============================================================
   SEGURANÇA
   ============================================================ */
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Frontend trata seu próprio CSP
}));

app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

/* ============================================================
   RATE LIMITING
   ============================================================ */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

const stockNotifLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/stock-notifications', (req, res, next) => {
  // Limita apenas o cadastro público (POST /), demais rotas seguem o limite global
  if (req.method === 'POST' && req.path === '/') return stockNotifLimiter(req, res, next);
  next();
});

/* ============================================================
   PARSING & LOGGING
   ============================================================ */
// Webhook do MP precisa do raw body antes do JSON parser
app.use('/api/payment/mp/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/* ============================================================
   HEALTH CHECK
   ============================================================ */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
  });
});

/* ============================================================
   ROTAS
   ============================================================ */
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/contact',    contactRoutes);
app.use('/api/images',     imageRoutes);
app.use('/api/launches',   launchRoutes);
app.use('/api/stock-notifications', stockNotificationRoutes);
app.use('/api/coupons',    couponRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/addresses',  addressRouter);
app.use('/api/admin',      adminRouter);
app.use('/api/payment',    paymentRouter);

/* ============================================================
   ERROS
   ============================================================ */
app.use(notFound);
app.use(errorHandler);

/* ============================================================
   START
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n🌿 L.A. STORE API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});

module.exports = app;
