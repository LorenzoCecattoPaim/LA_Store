/**
 * L.A. STORE — routes/launches.js
 * Rotas públicas e admin para Lançamentos
 */
const router = require('express').Router();
const { body } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

/* ============================================================
   ROTAS PÚBLICAS
   ============================================================ */

/* GET /api/launches — lista lançamentos publicados */
router.get('/', async (req, res, next) => {
  try {
    const { featured_home, limit = 10, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('launches')
      .select('id,title,subtitle,description,slug,cover_url,status,featured_home,sort_order,published_at', { count: 'exact' })
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (featured_home === 'true') {
      q = q.eq('featured_home', true);
    }

    const { data, count, error } = await q;
    if (error) throw error;

    res.json({ launches: data, total: count });
  } catch (err) { next(err); }
});

/* GET /api/launches/:slug — detalhe público de um lançamento */
router.get('/:slug', async (req, res, next) => {
  try {
    const { data: launch, error } = await supabase
      .from('launches')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('status', 'published')
      .single();

    if (error || !launch) return res.status(404).json({ error: 'Lançamento não encontrado.' });

    // Busca produtos vinculados
    const { data: lp, error: lpErr } = await supabase
      .from('launch_products')
      .select(`
        sort_order,
        product:products(
          id, name, slug, price, price_pix, badge, stock, active,
          images:product_images(url,alt,is_cover,sort_order)
        )
      `)
      .eq('launch_id', launch.id)
      .order('sort_order');

    if (lpErr) throw lpErr;

    const products = (lp || [])
      .map(r => r.product)
      .filter(p => p && p.active);

    res.json({ launch, products });
  } catch (err) { next(err); }
});

/* ============================================================
   ROTAS ADMIN
   ============================================================ */

/* GET /api/launches/admin/list */
router.get('/admin/list', auth, adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, count, error } = await supabase
      .from('launches')
      .select('id,title,subtitle,slug,status,featured_home,sort_order,cover_url,published_at,created_at', { count: 'exact' })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    res.json({ launches: data, total: count });
  } catch (err) { next(err); }
});

/* GET /api/launches/admin/:id */
router.get('/admin/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { data: launch, error } = await supabase
      .from('launches')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !launch) return res.status(404).json({ error: 'Lançamento não encontrado.' });

    const { data: lp } = await supabase
      .from('launch_products')
      .select('product_id, sort_order, product:products(id,name,slug,price)')
      .eq('launch_id', launch.id)
      .order('sort_order');

    res.json({ launch, products: (lp || []).map(r => ({ ...r.product, sort_order: r.sort_order })) });
  } catch (err) { next(err); }
});

/* POST /api/launches/admin — cria lançamento */
router.post('/admin',
  auth, adminOnly,
  body('title').trim().notEmpty().withMessage('Título obrigatório'),
  body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug inválido'),
  validate,
  async (req, res, next) => {
    try {
      const {
        title, subtitle, description, slug, cover_url,
        status = 'draft', featured_home = false, sort_order = 0,
        published_at, meta_title, meta_desc, product_ids = []
      } = req.body;

      // Verifica slug duplicado
      const { data: existing } = await supabase
        .from('launches').select('id').eq('slug', slug).single();
      if (existing) return res.status(409).json({ error: `Slug "${slug}" já está em uso.` });

      const { data: launch, error } = await supabase
        .from('launches')
        .insert({
          title, subtitle, description, slug, cover_url,
          status, featured_home, sort_order,
          published_at: status === 'published' && !published_at ? new Date().toISOString() : published_at || null,
          meta_title, meta_desc
        })
        .select()
        .single();

      if (error) throw error;

      // Vincula produtos
      if (product_ids.length > 0) {
        const rows = product_ids.map((pid, i) => ({
          launch_id: launch.id,
          product_id: pid,
          sort_order: i,
        }));
        await supabase.from('launch_products').insert(rows);
      }

      res.status(201).json({ launch });
    } catch (err) { next(err); }
  }
);

/* PUT /api/launches/admin/:id — atualiza lançamento */
router.put('/admin/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const {
      title, subtitle, description, slug, cover_url,
      status, featured_home, sort_order, published_at,
      meta_title, meta_desc, product_ids
    } = req.body;

    // Verifica slug duplicado (exceto o próprio)
    if (slug) {
      const { data: existing } = await supabase
        .from('launches').select('id').eq('slug', slug).neq('id', req.params.id).single();
      if (existing) return res.status(409).json({ error: `Slug "${slug}" já está em uso.` });
    }

    const fields = {};
    if (title !== undefined) fields.title = title;
    if (subtitle !== undefined) fields.subtitle = subtitle;
    if (description !== undefined) fields.description = description;
    if (slug !== undefined) fields.slug = slug;
    if (cover_url !== undefined) fields.cover_url = cover_url;
    if (status !== undefined) {
      fields.status = status;
      if (status === 'published' && !published_at) {
        fields.published_at = new Date().toISOString();
      }
    }
    if (published_at !== undefined) fields.published_at = published_at;
    if (featured_home !== undefined) fields.featured_home = featured_home;
    if (sort_order !== undefined) fields.sort_order = sort_order;
    if (meta_title !== undefined) fields.meta_title = meta_title;
    if (meta_desc !== undefined) fields.meta_desc = meta_desc;

    const { data: launch, error } = await supabase
      .from('launches')
      .update(fields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Atualiza produtos vinculados se fornecido
    if (Array.isArray(product_ids)) {
      await supabase.from('launch_products').delete().eq('launch_id', req.params.id);
      if (product_ids.length > 0) {
        const rows = product_ids.map((pid, i) => ({
          launch_id: req.params.id,
          product_id: pid,
          sort_order: i,
        }));
        await supabase.from('launch_products').insert(rows);
      }
    }

    res.json({ launch });
  } catch (err) { next(err); }
});

/* DELETE /api/launches/admin/:id */
router.delete('/admin/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('launches')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* PATCH /api/launches/admin/:id/order — reordenar */
router.patch('/admin/:id/order', auth, adminOnly, async (req, res, next) => {
  try {
    const { sort_order } = req.body;
    const { data, error } = await supabase
      .from('launches')
      .update({ sort_order })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ launch: data });
  } catch (err) { next(err); }
});

module.exports = router;
