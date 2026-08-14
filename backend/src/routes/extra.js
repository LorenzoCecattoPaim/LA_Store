/* ============================================================
   L.A. STORE — routes/coupons.js
   ============================================================ */
const couponRouter = require('express').Router();
const { body }     = require('express-validator');
const supabase      = require('../config/supabase');
const { auth, adminOnly } = require('../middleware/auth');
const { validate }  = require('../middleware/validate');

/* POST /api/coupons/validate */
couponRouter.post('/validate',
  body('code').trim().notEmpty(),
  body('subtotal').isFloat({ min: 0 }),
  validate,
  async (req, res, next) => {
    try {
      const { code, subtotal } = req.body;
      const { data: coupon } = await supabase
        .from('coupons').select('*').eq('code', code.toUpperCase()).eq('active', true).single();

      if (!coupon) return res.status(404).json({ error: 'Cupom inválido ou expirado.' });
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
        return res.status(400).json({ error: 'Cupom expirado.' });
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses)
        return res.status(400).json({ error: 'Cupom esgotado.' });
      if (subtotal < (coupon.min_order || 0))
        return res.status(400).json({ error: `Pedido mínimo de R$ ${Number(coupon.min_order).toFixed(2).replace('.',',')} para este cupom.` });

      const discount = coupon.type === 'percent'
        ? +(subtotal * coupon.value / 100).toFixed(2)
        : +Math.min(coupon.value, subtotal).toFixed(2);

      res.json({ coupon: { code: coupon.code, type: coupon.type, value: coupon.value, discount } });
    } catch (err) { next(err); }
  }
);

/* GET /api/coupons (admin) */
couponRouter.get('/', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ coupons: data });
  } catch (err) { next(err); }
});

/* POST /api/coupons (admin) */
couponRouter.post('/', auth, adminOnly,
  body('code').trim().notEmpty().toUpperCase(),
  body('type').isIn(['percent','fixed']),
  body('value').isFloat({ min: 0.01 }),
  validate,
  async (req, res, next) => {
    try {
      const { code, type, value, min_order, max_uses, expires_at } = req.body;
      const { data, error } = await supabase.from('coupons')
        .insert({ code: code.toUpperCase(), type, value, min_order: min_order||0, max_uses: max_uses||null, expires_at: expires_at||null })
        .select().single();
      if (error) throw error;
      res.status(201).json({ coupon: data });
    } catch (err) { next(err); }
  }
);

/* PATCH /api/coupons/:id (admin) */
couponRouter.patch('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { active } = req.body;
    const { data, error } = await supabase.from('coupons').update({ active }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ coupon: data });
  } catch (err) { next(err); }
});

/* ============================================================
   routes/newsletter.js
   ============================================================ */
const newsletterRouter = require('express').Router();

newsletterRouter.post('/',
  body('email').isEmail().normalizeEmail(),
  validate,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      await supabase.from('newsletter').upsert({ email, active: true }, { onConflict: 'email' });
      res.json({ message: 'Inscrito com sucesso!' });
    } catch (err) { next(err); }
  }
);

newsletterRouter.get('/', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('newsletter').select('*').eq('active', true).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ subscribers: data, total: data.length });
  } catch (err) { next(err); }
});

/* ============================================================
   routes/addresses.js
   ============================================================ */
const addressRouter = require('express').Router();

addressRouter.get('/', auth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('addresses').select('*').eq('user_id', req.user.id).order('is_default', { ascending: false });
    if (error) throw error;
    res.json({ addresses: data });
  } catch (err) { next(err); }
});

addressRouter.post('/', auth,
  body('zip').trim().notEmpty(), body('street').trim().notEmpty(),
  body('number').trim().notEmpty(), body('neighborhood').trim().notEmpty(),
  body('city').trim().notEmpty(), body('state').isLength({ min:2, max:2 }),
  validate,
  async (req, res, next) => {
    try {
      const { label, name, zip, street, number, complement, neighborhood, city, state, is_default } = req.body;
      if (is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
      const { data, error } = await supabase.from('addresses')
        .insert({ user_id: req.user.id, label: label||'Casa', name: name||req.user.name, zip, street, number, complement: complement||null, neighborhood, city, state, is_default: !!is_default })
        .select().single();
      if (error) throw error;
      res.status(201).json({ address: data });
    } catch (err) { next(err); }
  }
);

addressRouter.put('/:id', auth, async (req, res, next) => {
  try {
    const { label, name, zip, street, number, complement, neighborhood, city, state, is_default } = req.body;
    if (is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    const { data, error } = await supabase.from('addresses')
      .update({ label, name, zip, street, number, complement: complement||null, neighborhood, city, state, is_default: !!is_default })
      .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Endereço não encontrado.' });
    res.json({ address: data });
  } catch (err) { next(err); }
});

addressRouter.delete('/:id', auth, async (req, res, next) => {
  try {
    const { error } = await supabase.from('addresses').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ message: 'Endereço removido.' });
  } catch (err) { next(err); }
});

/* ============================================================
   routes/admin.js — métricas e dashboard
   ============================================================ */
const adminRouter = require('express').Router();

adminRouter.get('/metrics', auth, adminOnly, async (req, res, next) => {
  try {
    const [
      { count: totalOrders },
      { count: pendingOrders },
      { data: revenueData },
      { count: totalProducts },
      { count: totalClients },
      { count: stockProducts },
      { count: mtoProducts },
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).in('status',['pending','confirmed','in_production']),
      supabase.from('orders').select('total').eq('payment_status','paid'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('active',true),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role','customer'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('active',true).eq('product_type','stock'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('active',true).eq('product_type','made_to_order'),
    ]);

    const revenue = (revenueData || []).reduce((s, o) => s + Number(o.total), 0);

    res.json({
      metrics: {
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        revenue: +revenue.toFixed(2),
        total_products: totalProducts,
        total_clients: totalClients,
        stock_products: stockProducts || 0,
        mto_products: mtoProducts || 0,
      }
    });
  } catch (err) { next(err); }
});

adminRouter.get('/low-stock', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').select('id,name,sku,stock').lt('stock', 5).eq('active', true).eq('product_type', 'stock');
    if (error) throw error;
    res.json({ products: data });
  } catch (err) { next(err); }
});

adminRouter.get('/clients', auth, adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page)-1)*Number(limit);
    let q = supabase.from('users').select('id,name,email,phone,created_at', { count:'exact' })
      .eq('role','customer').order('created_at',{ ascending:false }).range(offset, offset+Number(limit)-1);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;
    res.json({ clients: data, total: count });
  } catch (err) { next(err); }
});

/* GET /api/admin/banners & PUT */
adminRouter.get('/banners', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('banners').select('*').order('sort_order');
    if (error) throw error;
    res.json({ banners: data });
  } catch (err) { next(err); }
});

adminRouter.put('/banners/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const fields = ['title','subtitle','eyebrow','cta_label','cta_url','active'];
    const payload = Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]]));
    const { data, error } = await supabase.from('banners').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ banner: data });
  } catch (err) { next(err); }
});

/* ── CATEGORIAS (admin) ── */

/* GET /api/admin/categories — todas (inclusive inativas) */
adminRouter.get('/categories', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ categories: data });
  } catch (err) { next(err); }
});

/* POST /api/admin/categories */
adminRouter.post('/categories', auth, adminOnly,
  body('name').trim().notEmpty().withMessage('Nome obrigatório'),
  body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug inválido (use apenas letras minúsculas, números e hífens)'),
  validate,
  async (req, res, next) => {
    try {
      const { name, slug, description, sort_order, active } = req.body;

      // Verifica se slug já existe
      const { data: existing } = await supabase
        .from('categories').select('id').eq('slug', slug).single();
      if (existing) return res.status(409).json({ error: `Slug "${slug}" já está em uso.` });

      const { data, error } = await supabase
        .from('categories')
        .insert({ name, slug, description: description || null, sort_order: sort_order || 0, active: active !== false })
        .select().single();
      if (error) throw error;
      res.status(201).json({ category: data });
    } catch (err) { next(err); }
  }
);

/* PUT /api/admin/categories/:id */
adminRouter.put('/categories/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const allowed = ['name','slug','description','sort_order','active'];
    const payload = Object.fromEntries(
      allowed.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]])
    );

    // Se slug está sendo alterado, verifica unicidade
    if (payload.slug) {
      const { data: existing } = await supabase
        .from('categories').select('id').eq('slug', payload.slug).neq('id', req.params.id).single();
      if (existing) return res.status(409).json({ error: `Slug "${payload.slug}" já está em uso.` });
    }

    const { data, error } = await supabase
      .from('categories').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Categoria não encontrada.' });
    res.json({ category: data });
  } catch (err) { next(err); }
});

/* DELETE /api/admin/categories/:id */
adminRouter.delete('/categories/:id', auth, adminOnly, async (req, res, next) => {
  try {
    // Verifica se há produtos vinculados
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', req.params.id)
      .eq('active', true);

    if (count > 0) {
      return res.status(409).json({
        error: `Esta categoria possui ${count} produto(s) ativo(s). Desative-os ou mova-os antes de excluir a categoria.`
      });
    }

    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Categoria excluída.' });
  } catch (err) { next(err); }
});

/* ============================================================
   routes/payment.js — Mercado Pago
   ============================================================ */
const paymentRouter = require('express').Router();

paymentRouter.post('/mp/preference', auth,
  body('order_id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { order_id } = req.body;
      const { data: order, error } = await supabase
        .from('orders').select('*,order_items(*)').eq('id', order_id).eq('user_id', req.user.id).single();
      if (error || !order) return res.status(404).json({ error: 'Pedido não encontrado.' });

      const { MercadoPagoConfig, Preference } = require('mercadopago');
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: order.order_items.map(i => ({
            id: i.product_id, title: i.product_name,
            quantity: i.quantity, unit_price: Number(i.unit_price), currency_id: 'BRL',
          })),
          payer: { name: order.customer_name, email: order.customer_email },
          external_reference: order.order_number,
          back_urls: {
            success: `${process.env.FRONTEND_URL}/pedido-confirmado?order=${order.id}`,
            failure: `${process.env.FRONTEND_URL}/checkout?order=${order.id}&error=payment`,
            pending: `${process.env.FRONTEND_URL}/pedido-confirmado?order=${order.id}&status=pending`,
          },
          auto_return: 'approved',
          notification_url: `${process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL}/api/payment/mp/webhook`,
        }
      });

      res.json({ init_point: result.init_point, preference_id: result.id });
    } catch (err) { next(err); }
  }
);

/* Webhook do Mercado Pago */
paymentRouter.post('/mp/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment') {
      const { MercadoPagoConfig, Payment } = require('mercadopago');
      const client  = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const payment = new Payment(client);
      const mpPayment = await payment.get({ id: data.id });

      const orderNumber = mpPayment.external_reference;
      const status      = mpPayment.status;

      if (orderNumber) {
        const paymentStatus = status === 'approved' ? 'paid' : status === 'pending' ? 'pending' : 'failed';
        const orderStatus   = status === 'approved' ? 'confirmed' : 'pending';

        await supabase.from('orders').update({
          payment_status: paymentStatus,
          status: orderStatus,
          payment_id: String(data.id),
        }).eq('order_number', orderNumber);

        if (status === 'approved') {
          const { data: order } = await supabase.from('orders').select('*,order_items(*)').eq('order_number', orderNumber).single();
          if (order) {
            mailer.sendOrderConfirmed({ to: order.customer_email, name: order.customer_name, order }).catch(() => {});
          }
        }
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(200); // sempre 200 para o MP não reenviar
  }
});

/* ================================================================
   Frete — GET /api/payment/shipping/:cep
   Integra ViaCEP para dados do endereço e calcula o frete.
================================================================ */
paymentRouter.get('/shipping/:cep', async (req, res, next) => {
  try {
    // 1. Normaliza e valida o CEP
    const cep = String(req.params.cep).replace(/\D/g, '');

    if (cep.length === 0) {
      return res.status(400).json({ error: 'CEP não informado.' });
    }
    if (cep.length !== 8) {
      return res.status(400).json({ error: 'CEP inválido. Informe 8 dígitos numéricos.' });
    }
    // Rejeita CEPs claramente inválidos (todos iguais: 00000000, 99999999)
    if (/^(\d)\1{7}$/.test(cep)) {
      return res.status(400).json({ error: 'CEP inválido.' });
    }

    // 2. Consulta ViaCEP com timeout de 5s
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

    let addr;
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 5000);
      const resp       = await fetch(
        `https://viacep.com.br/ws/${cep}/json/`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (resp.status === 400) {
        return res.status(400).json({ error: 'CEP inválido.' });
      }
      if (!resp.ok) {
        return res.status(502).json({ error: 'Serviço de consulta de CEP indisponível. Tente novamente.' });
      }

      addr = await resp.json();
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ error: 'Consulta de CEP expirou. Verifique sua conexão e tente novamente.' });
      }
      return res.status(502).json({ error: 'Não foi possível consultar o CEP. Tente novamente.' });
    }

    // 3. Valida resposta do ViaCEP
    if (addr.erro === true || addr.erro === 'true') {
      return res.status(404).json({ error: 'CEP não encontrado. Verifique o número e tente novamente.' });
    }
    if (!addr.uf) {
      return res.status(502).json({ error: 'Resposta de CEP inválida. Tente novamente.' });
    }

    // 4. Calcula frete
    const { shippingStandardForState, SHIPPING_FREE_FROM } = require('../utils/helpers');
    const standard = shippingStandardForState(addr.uf);

    return res.json({
      address: {
        zip:          cep,
        street:       addr.logradouro   || '',
        neighborhood: addr.bairro       || '',
        city:         addr.localidade   || '',
        state:        addr.uf,
      },
      shipping: {
        standard,
        free_from: SHIPPING_FREE_FROM,
      },
    });

  } catch (err) {
    next(err);
  }
});

module.exports = { couponRouter, newsletterRouter, addressRouter, adminRouter, paymentRouter };
