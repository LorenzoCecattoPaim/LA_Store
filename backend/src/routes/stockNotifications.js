const router  = require('express').Router();
const { body } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { processBackInStockNotifications } = require('../utils/stockNotificationService');

/* ================================================================
   PÚBLICO — Cliente solicita ser avisado
   POST /api/stock-notifications
   Funciona logado (usa req.user) ou anônimo (exige email no body).
================================================================ */
router.post('/',
  optionalAuth,
  [
    body('product_id').isUUID().withMessage('Produto inválido.'),
    body('email').optional().isEmail().withMessage('E-mail inválido.'),
    body('name').optional().isLength({ max: 120 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { product_id } = req.body;
      const isLogged = !!req.user;

      const email = isLogged ? req.user.email : (req.body.email || '').trim().toLowerCase();
      const name  = isLogged ? req.user.name  : (req.body.name || '').trim() || null;

      if (!email) {
        return res.status(422).json({ error: 'E-mail é obrigatório.' });
      }

      /* Confirma que o produto existe, trabalha com estoque e está esgotado */
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('id,name,stock,product_type,active')
        .eq('id', product_id)
        .single();

      if (pErr || !product) return res.status(404).json({ error: 'Produto não encontrado.' });
      if (product.product_type === 'made_to_order') {
        return res.status(400).json({ error: 'Este produto é produzido sob encomenda e não utiliza notificação de estoque.' });
      }
      if (Number(product.stock) > 0) {
        return res.status(400).json({ error: 'Este produto já está disponível em estoque.' });
      }

      /* Verifica duplicidade — mesmo e-mail já acompanhando este produto */
      const { data: existing } = await supabase
        .from('stock_notifications')
        .select('id')
        .eq('product_id', product_id)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Você já está acompanhando este produto.', already_subscribed: true });
      }

      const { data: notification, error } = await supabase
        .from('stock_notifications')
        .insert({
          product_id,
          user_id: isLogged ? req.user.id : null,
          name,
          email,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        // Corrida concorrente pode bater no índice único — trata como duplicidade amigável
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Você já está acompanhando este produto.', already_subscribed: true });
        }
        throw error;
      }

      res.status(201).json({ notification, message: 'Notificação cadastrada com sucesso.' });
    } catch (err) { next(err); }
  }
);

/* ================================================================
   CLIENTE LOGADO — Minhas notificações
   GET /api/stock-notifications/mine
================================================================ */
router.get('/mine', auth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('stock_notifications')
      .select(`
        id, status, notified_at, created_at,
        product:products(id, name, slug, stock,
          images:product_images(url,is_cover)
        )
      `)
      .eq('user_id', req.user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ notifications: data || [] });
  } catch (err) { next(err); }
});

/* ================================================================
   CLIENTE LOGADO — Cancelar notificação (parar de acompanhar)
   DELETE /api/stock-notifications/:id
================================================================ */
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { data: existing, error: fErr } = await supabase
      .from('stock_notifications')
      .select('id,user_id')
      .eq('id', req.params.id)
      .single();

    if (fErr || !existing) return res.status(404).json({ error: 'Notificação não encontrada.' });
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta notificação.' });
    }

    const { error } = await supabase
      .from('stock_notifications')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Você deixou de acompanhar este produto.' });
  } catch (err) { next(err); }
});

/* ================================================================
   ADMIN — Listagem com filtros
   GET /api/stock-notifications/admin/list
================================================================ */
router.get('/admin/list', auth, adminOnly, async (req, res, next) => {
  try {
    const { status, product_id, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('stock_notifications')
      .select(`
        id, name, email, status, notified_at, created_at,
        product:products(id, name, slug, stock, sku),
        user:users(id, name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status && ['pending', 'notified', 'cancelled'].includes(status)) {
      q = q.eq('status', status);
    }
    if (product_id) q = q.eq('product_id', product_id);
    if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`);

    const { data, count, error } = await q;
    if (error) throw error;

    res.json({ notifications: data || [], total: count || 0 });
  } catch (err) { next(err); }
});

/* ================================================================
   ADMIN — Métricas de notificações (produtos com mais interesse)
   GET /api/stock-notifications/admin/metrics
================================================================ */
router.get('/admin/metrics', auth, adminOnly, async (req, res, next) => {
  try {
    const [
      { count: totalPending },
      { count: totalNotified },
      { data: byProduct },
    ] = await Promise.all([
      supabase.from('stock_notifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('stock_notifications').select('*', { count: 'exact', head: true }).eq('status', 'notified'),
      supabase
        .from('stock_notifications')
        .select('product_id, product:products(id,name,slug,stock)')
        .neq('status', 'cancelled'),
    ]);

    /* Agrupa por produto para identificar os mais solicitados */
    const grouped = {};
    (byProduct || []).forEach(row => {
      if (!row.product) return;
      const key = row.product_id;
      if (!grouped[key]) {
        grouped[key] = { product: row.product, count: 0 };
      }
      grouped[key].count += 1;
    });

    const topProducts = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      metrics: {
        total_pending: totalPending || 0,
        total_notified: totalNotified || 0,
        top_products: topProducts,
      }
    });
  } catch (err) { next(err); }
});

/* ================================================================
   ADMIN — Disparar notificações manualmente para um produto
   POST /api/stock-notifications/admin/trigger/:productId
   Útil para testar o fluxo e para reprocessar notificações que
   falharam por problema temporário de e-mail.
================================================================ */
router.post('/admin/trigger/:productId', auth, adminOnly, async (req, res, next) => {
  try {
    const { productId } = req.params;

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, name, stock, product_type')
      .eq('id', productId)
      .single();

    if (pErr || !product) return res.status(404).json({ error: 'Produto não encontrado.' });
    if (Number(product.stock) <= 0) {
      return res.status(400).json({ error: 'Produto sem estoque. Reabastece o estoque antes de disparar notificações.' });
    }
    if (product.product_type === 'made_to_order') {
      return res.status(400).json({ error: 'Produto sob encomenda não usa notificação de estoque.' });
    }

    // Roda em background, responde imediatamente ao admin
    processBackInStockNotifications(productId, 0, Number(product.stock))
      .catch(err => console.error('[BACK_IN_STOCK] Falha no trigger manual:', err?.stack || err?.message));

    res.json({ message: `Disparo de notificações iniciado para "${product.name}". Verifique os logs do servidor.` });
  } catch (err) { next(err); }
});

module.exports = router;
