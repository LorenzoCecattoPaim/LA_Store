const router  = require('express').Router();
const { body } = require('express-validator');
const supabase  = require('../config/supabase');
const { auth, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

/* Campos de personalização permitidos (sistema legado — sem uso na L.A. STORE,
   mantido apenas por compatibilidade com dados antigos) */
const CUSTOM_FIELDS = [
  'allow_customization','allow_colors','allow_marble','allow_metallic','metallic_price'
];

/* Tipo de produto */
const PRODUCT_TYPE_FIELDS = ['product_type'];

/* Campos de moda (L.A. STORE) */
const FASHION_FIELDS = ['brand_id','composition','care_instructions','promo_price'];

/* ================================================================
   ROTAS ESTÁTICAS — devem vir ANTES de qualquer /:param
   (Express resolve rotas em ordem; /:slug engoleria /categories etc.)
================================================================ */

/* GET /api/products/categories — inclui subcategorias (parent_id) */
router.get('/categories', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('categories').select('id,slug,name,description,parent_id').eq('active', true).order('sort_order');
    if (error) throw error;
    res.json({ categories: data });
  } catch (err) { next(err); }
});

/* GET /api/products/brands (público) */
router.get('/brands', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('brands').select('id,slug,name,description,logo_url').eq('active', true).order('sort_order');
    if (error) throw error;
    res.json({ brands: data });
  } catch (err) { next(err); }
});

/* GET /api/products/colors (público) */
router.get('/colors', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('colors').select('id,name,hex').eq('active', true).order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});

/* GET /api/products/sizes (público) */
router.get('/sizes', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sizes').select('id,label').eq('active', true).order('sort_order');
    if (error) throw error;
    res.json({ sizes: data });
  } catch (err) { next(err); }
});

/* ---- Admin CRUD: marcas ---- */
router.get('/admin/brands', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('brands').select('*').order('sort_order');
    if (error) throw error;
    res.json({ brands: data });
  } catch (err) { next(err); }
});
router.post('/admin/brands', auth, adminOnly, async (req, res, next) => {
  try {
    const { slug, name, description, logo_url, sort_order = 0 } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug e name obrigatórios.' });
    const { data, error } = await supabase.from('brands')
      .insert({ slug, name, description, logo_url, sort_order }).select().single();
    if (error) throw error;
    res.status(201).json({ brand: data });
  } catch (err) { next(err); }
});
router.put('/admin/brands/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const fields = ['slug','name','description','logo_url','sort_order','active'];
    const payload = Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]]));
    const { data, error } = await supabase.from('brands').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ brand: data });
  } catch (err) { next(err); }
});
router.delete('/admin/brands/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase.from('brands').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Marca desativada.' });
  } catch (err) { next(err); }
});

/* ---- Admin CRUD: cores ---- */
router.get('/admin/colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('colors').select('*').order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});
router.post('/admin/colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, hex, sort_order = 0 } = req.body;
    if (!name || !hex) return res.status(400).json({ error: 'name e hex obrigatórios.' });
    const { data, error } = await supabase.from('colors').insert({ name, hex, sort_order }).select().single();
    if (error) throw error;
    res.status(201).json({ color: data });
  } catch (err) { next(err); }
});
router.put('/admin/colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const fields = ['name','hex','sort_order','active'];
    const payload = Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]]));
    const { data, error } = await supabase.from('colors').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ color: data });
  } catch (err) { next(err); }
});
router.delete('/admin/colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase.from('colors').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Cor desativada.' });
  } catch (err) { next(err); }
});

/* ---- Admin CRUD: tamanhos ---- */
router.get('/admin/sizes', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('sizes').select('*').order('sort_order');
    if (error) throw error;
    res.json({ sizes: data });
  } catch (err) { next(err); }
});
router.post('/admin/sizes', auth, adminOnly, async (req, res, next) => {
  try {
    const { label, sort_order = 0 } = req.body;
    if (!label) return res.status(400).json({ error: 'label obrigatório.' });
    const { data, error } = await supabase.from('sizes').insert({ label, sort_order }).select().single();
    if (error) throw error;
    res.status(201).json({ size: data });
  } catch (err) { next(err); }
});
router.delete('/admin/sizes/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase.from('sizes').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Tamanho desativado.' });
  } catch (err) { next(err); }
});

/* GET /api/products/customization-colors — cores globais das peças (público) */
router.get('/customization-colors', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('customization_colors')
      .select('id,name,hex,sort_order')
      .eq('active', true)
      .order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});

/* GET /api/products/marble-colors — cores do marmorizado (público) */
router.get('/marble-colors', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('marble_colors')
      .select('id,name,hex,sort_order')
      .eq('active', true)
      .order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});

/* GET /api/products/admin/list (admin) */
router.get('/admin/list', auth, adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, product_type: filterType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('products')
      .select(`
        id, sku, name, slug, price, stock, active, featured, product_type,
        category:categories(id,slug,name),
        brand:brands(id,slug,name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (filterType && ['stock','made_to_order'].includes(filterType)) {
      q = q.eq('product_type', filterType);
    }

    const { data, count, error } = await q;
    if (error) throw error;
    res.json({ products: data || [], total: count });
  } catch (err) { next(err); }
});

/* GET /api/products/admin/customization-colors (admin) */
router.get('/admin/customization-colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('customization_colors').select('*').order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});

/* POST /api/products/admin/customization-colors (admin) */
router.post('/admin/customization-colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, hex, sort_order = 0 } = req.body;
    if (!name || !hex) return res.status(400).json({ error: 'name e hex obrigatórios.' });
    const { data, error } = await supabase
      .from('customization_colors').insert({ name, hex, sort_order }).select().single();
    if (error) throw error;
    res.status(201).json({ color: data });
  } catch (err) { next(err); }
});

/* PUT /api/products/admin/customization-colors/:id (admin) */
router.put('/admin/customization-colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, hex, sort_order, active } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (hex !== undefined) payload.hex = hex;
    if (sort_order !== undefined) payload.sort_order = sort_order;
    if (active !== undefined) payload.active = active;
    const { data, error } = await supabase
      .from('customization_colors').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ color: data });
  } catch (err) { next(err); }
});

/* DELETE /api/products/admin/customization-colors/:id (admin) */
router.delete('/admin/customization-colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('customization_colors').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Cor desativada.' });
  } catch (err) { next(err); }
});

/* GET /api/products/admin/marble-colors (admin) */
router.get('/admin/marble-colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('marble_colors').select('*').order('sort_order');
    if (error) throw error;
    res.json({ colors: data });
  } catch (err) { next(err); }
});

/* POST /api/products/admin/marble-colors (admin) */
router.post('/admin/marble-colors', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, hex, sort_order = 0 } = req.body;
    if (!name || !hex) return res.status(400).json({ error: 'name e hex obrigatórios.' });
    const { data, error } = await supabase
      .from('marble_colors').insert({ name, hex, sort_order }).select().single();
    if (error) throw error;
    res.status(201).json({ color: data });
  } catch (err) { next(err); }
});

/* PUT /api/products/admin/marble-colors/:id (admin) */
router.put('/admin/marble-colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, hex, sort_order, active } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (hex !== undefined) payload.hex = hex;
    if (sort_order !== undefined) payload.sort_order = sort_order;
    if (active !== undefined) payload.active = active;
    const { data, error } = await supabase
      .from('marble_colors').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ color: data });
  } catch (err) { next(err); }
});

/* DELETE /api/products/admin/marble-colors/:id (admin) */
router.delete('/admin/marble-colors/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('marble_colors').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Cor de marmorizado desativada.' });
  } catch (err) { next(err); }
});

/* ================================================================
   ROTA PÚBLICA DE LISTAGEM
================================================================ */

/* GET /api/products
   Filtros: category (slug, aceita categoria-mãe ou subcategoria), brand (slug),
   size, color (nome), min_price, max_price, search, featured
   Ordenação: sort=price|name|created_at|best_selling  order=asc|desc */
router.get('/', async (req, res, next) => {
  try {
    const {
      category, brand, size, color, min_price, max_price,
      featured, search, in_stock,
      sort = 'created_at', order = 'desc',
      page = 1, limit = 20
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('products')
      .select(`
        id, sku, name, slug, price, price_pix, promo_price, stock, badge, featured, active, product_type,
        composition, care_instructions,
        category:categories(id,slug,name,parent_id),
        brand:brands(id,slug,name),
        images:product_images(url,alt,is_cover),
        variant_stock:product_variant_stock(size,color_name,quantity)
      `, { count: 'exact' })
      .eq('active', true)
      .range(offset, offset + Number(limit) - 1);

    if (category) {
      // Aceita slug de categoria-mãe (ex: "feminino") ou subcategoria (ex: "feminino-blusas")
      const { data: catMatch } = await supabase.from('categories').select('id,parent_id').eq('slug', category).maybeSingle();
      if (catMatch) {
        const { data: children } = await supabase.from('categories').select('id').eq('parent_id', catMatch.id);
        const ids = [catMatch.id, ...(children || []).map(c => c.id)];
        q = q.in('category_id', ids);
      }
    }
    if (brand) {
      const { data: brandMatch } = await supabase.from('brands').select('id').eq('slug', brand).maybeSingle();
      if (brandMatch) q = q.eq('brand_id', brandMatch.id);
    }
    if (featured === 'true') q = q.eq('featured', true);
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    if (min_price) q = q.gte('price', Number(min_price));
    if (max_price) q = q.lte('price', Number(max_price));
    if (sort === 'best_selling') {
      q = q.order('featured', { ascending: false }).order('created_at', { ascending: false });
    } else if (['price','name','created_at'].includes(sort)) {
      q = q.order(sort, { ascending: order === 'asc' });
    }

    const { data, count, error } = await q;
    if (error) throw error;

    let products = data || [];

    // Filtros que dependem do array de variant_stock (aplicados em memória)
    if (size) products = products.filter(p => (p.variant_stock || []).some(v => v.size === size));
    if (color) products = products.filter(p => (p.variant_stock || []).some(v => v.color_name === color));
    if (in_stock === 'true') {
      products = products.filter(p => (p.variant_stock || []).some(v => v.quantity > 0) || (p.product_type === 'made_to_order'));
    }

    // Anexa lista resumida de tamanhos/cores disponíveis (com estoque > 0) para os cards do catálogo
    products = products.map(p => {
      const vs = p.variant_stock || [];
      const availableSizes = [...new Set(vs.filter(v => v.quantity > 0).map(v => v.size))];
      const availableColors = [...new Set(vs.filter(v => v.quantity > 0).map(v => v.color_name))];
      const totalStock = vs.reduce((sum, v) => sum + v.quantity, 0);
      const { variant_stock, ...rest } = p;
      return { ...rest, available_sizes: availableSizes, available_colors: availableColors, has_variants: vs.length > 0, total_variant_stock: totalStock };
    });

    res.json({ products, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

/* ================================================================
   ROTAS DE PRODUTO POR SLUG — APÓS todas as estáticas
================================================================ */

/* GET /api/products/:slug
   Retorna também: variant_stock (matriz tamanho x cor com quantidade),
   size_guide (tabela de medidas) e brand. */
router.get('/:slug', async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id,slug,name,parent_id),
        brand:brands(id,slug,name),
        images:product_images(id,url,alt,is_cover,sort_order),
        variant_stock:product_variant_stock(id,size,color_id,color_name,sku_variant,quantity),
        size_guide:size_guide_entries(size,bust_cm,waist_cm,hip_cm,sort_order),
        reviews(id,rating,title,body,created_at,approved,user:users(name))
      `)
      .eq('slug', req.params.slug)
      .eq('active', true)
      .single();

    if (error || !product) return res.status(404).json({ error: 'Produto não encontrado.' });

    product.images      = (product.images || []).sort((a, b) => a.sort_order - b.sort_order);
    product.size_guide  = (product.size_guide || []).sort((a, b) => a.sort_order - b.sort_order);
    product.variant_stock = product.variant_stock || [];
    product.reviews     = (product.reviews || []).filter(r => r.approved);

    // Listas únicas de tamanhos e cores disponíveis para montar os seletores no front
    product.sizes  = [...new Set(product.variant_stock.map(v => v.size))];
    product.colors = [...new Map(product.variant_stock.map(v => [v.color_name, { name: v.color_name, id: v.color_id }])).values()];
    product.total_stock = product.variant_stock.reduce((s, v) => s + v.quantity, 0);

    const avgRating = product.reviews.length
      ? (product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length).toFixed(1)
      : null;

    res.json({ product: { ...product, avg_rating: avgRating } });
  } catch (err) { next(err); }
});

/* ================================================================
   ESTOQUE POR VARIAÇÃO (produto + tamanho + cor)
================================================================ */

/* GET /api/products/:id/stock (admin) — matriz completa, mesmo com qty 0 */
router.get('/:id/stock', auth, adminOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_variant_stock')
      .select('id,size,color_id,color_name,sku_variant,quantity')
      .eq('product_id', req.params.id)
      .order('color_name').order('size');
    if (error) throw error;
    res.json({ stock: data });
  } catch (err) { next(err); }
});

/* PUT /api/products/:id/stock (admin) — upsert em lote da matriz tamanho x cor
   Body: { rows: [{ size, color_name, color_id, quantity, sku_variant }] } */
router.put('/:id/stock', auth, adminOnly, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows deve ser um array.' });

    const payload = rows.map(r => ({
      product_id: req.params.id,
      size: r.size,
      color_id: r.color_id || null,
      color_name: r.color_name,
      sku_variant: r.sku_variant || null,
      quantity: Math.max(0, Number(r.quantity) || 0),
    }));

    const { data, error } = await supabase
      .from('product_variant_stock')
      .upsert(payload, { onConflict: 'product_id,size,color_name' })
      .select();
    if (error) throw error;

    // Mantém products.stock como soma total (compatibilidade com telas antigas/relatórios)
    const { data: allRows } = await supabase
      .from('product_variant_stock').select('quantity').eq('product_id', req.params.id);
    const total = (allRows || []).reduce((s, r) => s + r.quantity, 0);
    await supabase.from('products').update({ stock: total }).eq('id', req.params.id);

    res.json({ stock: data, total_stock: total });
  } catch (err) { next(err); }
});

/* DELETE /api/products/:id/stock/:stockId (admin) — remove uma combinação específica */
router.delete('/:id/stock/:stockId', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('product_variant_stock').delete().eq('id', req.params.stockId).eq('product_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Combinação removida.' });
  } catch (err) { next(err); }
});

/* GET /api/products/:id/availability?size=M&color=Preto (público)
   Checagem rápida de disponibilidade antes de adicionar à sacola. */
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { size, color } = req.query;
    if (!size || !color) return res.status(400).json({ error: 'size e color são obrigatórios.' });
    const { data, error } = await supabase
      .from('product_variant_stock')
      .select('quantity')
      .eq('product_id', req.params.id).eq('size', size).eq('color_name', color)
      .maybeSingle();
    if (error) throw error;
    res.json({ available: (data?.quantity || 0) > 0, quantity: data?.quantity || 0 });
  } catch (err) { next(err); }
});

/* ================================================================
   GUIA DE MEDIDAS
================================================================ */

/* GET /api/products/:id/size-guide (público) */
router.get('/:id/size-guide', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('size_guide_entries').select('size,bust_cm,waist_cm,hip_cm,sort_order')
      .eq('product_id', req.params.id).order('sort_order');
    if (error) throw error;
    res.json({ size_guide: data });
  } catch (err) { next(err); }
});

/* PUT /api/products/:id/size-guide (admin) — upsert em lote
   Body: { rows: [{ size, bust_cm, waist_cm, hip_cm }] } */
router.put('/:id/size-guide', auth, adminOnly, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows deve ser um array.' });
    await supabase.from('size_guide_entries').delete().eq('product_id', req.params.id);
    if (!rows.length) return res.json({ size_guide: [] });
    const payload = rows.map((r, i) => ({
      product_id: req.params.id, size: r.size,
      bust_cm: r.bust_cm || null, waist_cm: r.waist_cm || null, hip_cm: r.hip_cm || null,
      sort_order: i + 1,
    }));
    const { data, error } = await supabase.from('size_guide_entries').insert(payload).select();
    if (error) throw error;
    res.json({ size_guide: data });
  } catch (err) { next(err); }
});

/* ================================================================
   CRUD ADMIN — criação e edição de produtos
================================================================ */

/* POST /api/products (admin) */
router.post('/', auth, adminOnly,
  body('sku').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('slug').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  validate,
  async (req, res, next) => {
    try {
      const baseFields = [
        'sku','name','slug','category_id','price','price_pix','description',
        'production_days','stock','badge','featured','active'
      ];
      const payload = Object.fromEntries(
        [...baseFields, ...FASHION_FIELDS, ...PRODUCT_TYPE_FIELDS]
          .filter(f => req.body[f] !== undefined)
          .map(f => [f, req.body[f]])
      );
      if (!payload.product_type) payload.product_type = 'stock';

      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) throw error;

      // Estoque inicial por tamanho/cor (opcional no cadastro — pode ser feito depois em Produtos > Estoque)
      if (Array.isArray(req.body.variant_stock) && req.body.variant_stock.length && data.id) {
        const rows = req.body.variant_stock.map(r => ({
          product_id: data.id, size: r.size, color_id: r.color_id || null,
          color_name: r.color_name, sku_variant: r.sku_variant || null,
          quantity: Math.max(0, Number(r.quantity) || 0),
        }));
        await supabase.from('product_variant_stock').upsert(rows, { onConflict: 'product_id,size,color_name' });
      }

      res.status(201).json({ product: data });
    } catch (err) { next(err); }
  }
);

/* PUT /api/products/:id (admin) */
router.put('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const baseFields = [
      'name','slug','category_id','price','price_pix','description',
      'production_days','stock','badge','featured','active'
    ];
    const payload = Object.fromEntries(
      [...baseFields, ...FASHION_FIELDS, ...PRODUCT_TYPE_FIELDS]
        .filter(f => req.body[f] !== undefined)
        .map(f => [f, req.body[f]])
    );

    const { data, error } = await supabase
      .from('products').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Produto não encontrado.' });

    res.json({ product: data });
  } catch (err) { next(err); }
});

/* DELETE /api/products/:id (admin — soft delete) */
router.delete('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('products').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Produto desativado.' });
  } catch (err) { next(err); }
});

/* POST /api/products/:id/images (admin) */
router.post('/:id/images', auth, adminOnly,
  body('url').isURL().withMessage('URL inválida'),
  validate,
  async (req, res, next) => {
    try {
      const { url, alt, sort_order = 0, is_cover = false } = req.body;
      if (is_cover) {
        await supabase.from('product_images').update({ is_cover: false }).eq('product_id', req.params.id);
      }
      const { data, error } = await supabase.from('product_images')
        .insert({ product_id: req.params.id, url, alt, sort_order, is_cover }).select().single();
      if (error) throw error;
      res.status(201).json({ image: data });
    } catch (err) { next(err); }
  }
);

/* POST /api/products/:id/variants (admin) */
router.post('/:id/variants', auth, adminOnly,
  body('type').isIn(['color','size']),
  body('label').notEmpty(),
  body('value').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { type, label, value, hex, sort_order = 0 } = req.body;
      const { data, error } = await supabase.from('product_variants')
        .insert({ product_id: req.params.id, type, label, value, hex, sort_order }).select().single();
      if (error) throw error;
      res.status(201).json({ variant: data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
