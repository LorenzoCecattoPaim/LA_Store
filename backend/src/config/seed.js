/**
 * L.A. STORE — Seed: catálogo de moda (marcas, categorias, produtos,
 * estoque por tamanho+cor e guia de medidas)
 *
 * Pré-requisitos: rode antes, nesta ordem:
 *   1) node src/config/migrate.js            (cole o SQL no Supabase)
 *   2) migrate_fashion_variants.sql           (cole no Supabase)
 *   3) node src/config/seed.js                (este arquivo)
 */
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const supabase = require('./supabase');

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'');
}
function makeSku(brand, name, idx) {
  const s = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  return `${brand}-${s}${String(idx).padStart(2,'0')}`;
}
function pix(p){ return +(p*0.95).toFixed(2); }

// Estoque padrão de exemplo por tamanho — o admin ajusta depois no painel
const ESTOQUE_PADRAO = { PP:3, P:6, M:8, G:6, GG:3 };

/**
 * Produtos de EXEMPLO — servem para você ver o modelo funcionando.
 * Troque por peças reais no painel administrativo (Produtos > Novo produto).
 */
function buildProducts({ catMap, brandMap }) {
  return [
    {
      sku: makeSku('BIA','Blusa Manga Longa',1), name:'Blusa Manga Longa',
      slug: slugify('Blusa Manga Longa Biamar'), category_id: catMap['feminino-blusas'], brand_id: brandMap['biamar'],
      price: 149.90, price_pix: pix(149.90),
      description: 'Blusa de manga longa com caimento fluido, ideal para compor looks do dia a dia ao work wear.',
      composition: '96% Poliéster, 4% Elastano', care_instructions: 'Lavar à mão, não usar alvejante, secar à sombra.',
      production_days: 2, stock: 0, badge: 'Novo', featured: true, active: true,
      colors: ['Preto','Off-white'],
    },
    {
      sku: makeSku('ANS','Calça Alfaiataria',1), name:'Calça Alfaiataria',
      slug: slugify('Calca Alfaiataria Anselmi'), category_id: catMap['feminino-calcas'], brand_id: brandMap['anselmi'],
      price: 229.90, price_pix: pix(229.90),
      description: 'Calça de alfaiataria com cintura alta e caimento reto — peça-chave para looks elegantes.',
      composition: '70% Viscose, 27% Poliéster, 3% Elastano', care_instructions: 'Lavar a seco recomendado.',
      production_days: 2, stock: 0, badge: null, featured: true, active: true,
      colors: ['Preto','Marrom'],
    },
    {
      sku: makeSku('BIA','Vestido Midi',1), name:'Vestido Midi',
      slug: slugify('Vestido Midi Biamar'), category_id: catMap['feminino-vestidos'], brand_id: brandMap['biamar'],
      price: 269.90, price_pix: pix(269.90),
      description: 'Vestido midi de tecido leve, com fenda discreta e caimento que valoriza a silhueta.',
      composition: '100% Viscose', care_instructions: 'Lavar à mão em água fria.',
      production_days: 2, stock: 0, badge: 'Lançamento', featured: true, active: true,
      colors: ['Verde','Preto'],
    },
    {
      sku: makeSku('ANS','Camisa Slim',1), name:'Camisa Slim',
      slug: slugify('Camisa Slim Anselmi'), category_id: catMap['masculino-camisas'], brand_id: brandMap['anselmi'],
      price: 189.90, price_pix: pix(189.90),
      description: 'Camisa de corte slim em tecido de fácil manutenção — do escritório ao happy hour.',
      composition: '100% Algodão', care_instructions: 'Lavar à máquina, ciclo delicado.',
      production_days: 2, stock: 0, badge: null, featured: true, active: true,
      colors: ['Branco','Azul'],
    },
    {
      sku: makeSku('BIA','Camiseta Basica',1), name:'Camiseta Básica',
      slug: slugify('Camiseta Basica Biamar'), category_id: catMap['masculino-camisetas'], brand_id: brandMap['biamar'],
      price: 79.90, price_pix: pix(79.90),
      description: 'Camiseta básica de algodão premium, corte reto e caimento confortável.',
      composition: '100% Algodão Penteado', care_instructions: 'Lavar à máquina com cores semelhantes.',
      production_days: 2, stock: 0, badge: null, featured: false, active: true,
      colors: ['Preto','Branco','Grafite'],
    },
    {
      sku: makeSku('ANS','Jaqueta Corta Vento',1), name:'Jaqueta Corta-Vento',
      slug: slugify('Jaqueta Corta Vento Anselmi'), category_id: catMap['masculino-jaquetas'], brand_id: brandMap['anselmi'],
      price: 249.90, price_pix: pix(249.90),
      description: 'Jaqueta corta-vento leve, ideal para dias de temperatura instável.',
      composition: '100% Poliéster', care_instructions: 'Lavar à máquina, não usar secadora.',
      production_days: 2, stock: 0, badge: 'Novo', featured: false, active: true,
      colors: ['Preto','Azul'],
    },
    {
      sku: makeSku('BIA','Conjunto Moletom',1), name:'Conjunto Moletom Infantil',
      slug: slugify('Conjunto Moletom Infantil Kids'), category_id: catMap['infantil-infantil'], brand_id: brandMap['biamar'],
      price: 159.90, price_pix: pix(159.90),
      description: 'Conjunto de moletom infantil confortável, ideal para o dia a dia. Linha L.A. STORE KIDS.',
      composition: '80% Algodão, 20% Poliéster', care_instructions: 'Lavar à máquina com água fria.',
      production_days: 2, stock: 0, badge: 'L.A. STORE KIDS', featured: true, active: true,
      colors: ['Bege','Azul'],
    },
    {
      sku: makeSku('ANS','Vestido Infantil',1), name:'Vestido Infantil Estampado',
      slug: slugify('Vestido Infantil Estampado Kids'), category_id: catMap['infantil-meninas'], brand_id: brandMap['anselmi'],
      price: 119.90, price_pix: pix(119.90),
      description: 'Vestido infantil leve e estampado, perfeito para ocasiões especiais. Linha L.A. STORE KIDS.',
      composition: '100% Algodão', care_instructions: 'Lavar à mão, não usar alvejante.',
      production_days: 2, stock: 0, badge: null, featured: false, active: true,
      colors: ['Off-white','Verde'],
    },
  ];
}

// Guia de medidas padrão (busto/cintura/quadril em cm) — usado nos produtos femininos de exemplo
const SIZE_GUIDE_ADULT = [
  { size:'PP', bust_cm:82,  waist_cm:64,  hip_cm:90  },
  { size:'P',  bust_cm:86,  waist_cm:68,  hip_cm:94  },
  { size:'M',  bust_cm:90,  waist_cm:72,  hip_cm:98  },
  { size:'G',  bust_cm:94,  waist_cm:76,  hip_cm:102 },
  { size:'GG', bust_cm:98,  waist_cm:80,  hip_cm:106 },
];

async function seed() {
  console.log('🌱  Seed L.A. STORE — catálogo de moda\n');

  // Marcas
  const { data: brands, error: bE } = await supabase.from('brands')
    .upsert([{ slug:'biamar', name:'BIAMAR', sort_order:1 }, { slug:'anselmi', name:'ANSELMI', sort_order:2 }], { onConflict:'slug' })
    .select('id,slug');
  if (bE) { console.error('Marcas:', bE.message); return; }
  const brandMap = Object.fromEntries((brands || []).map(b => [b.slug, b.id]));
  console.log(`✅  ${brands?.length || 0} marcas`);

  // Categorias (feminino/masculino/infantil + subcategorias) — ver migrate_fashion_variants.sql
  const { data: cats, error: cE } = await supabase.from('categories').select('id,slug');
  if (cE) { console.error('Categorias:', cE.message); return; }
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));
  if (!catMap['feminino-blusas']) {
    console.error('⚠️  Categorias de moda não encontradas. Rode migrate_fashion_variants.sql antes deste seed.');
    return;
  }
  console.log(`✅  ${cats.length} categorias`);

  // Cores
  const { data: colors, error: colE } = await supabase.from('colors').select('id,name');
  if (colE) { console.error('Cores:', colE.message); return; }
  const colorMap = Object.fromEntries(colors.map(c => [c.name, c.id]));
  console.log(`✅  ${colors.length} cores disponíveis`);

  // Produtos
  const produtosRaw = buildProducts({ catMap, brandMap });
  const produtos = produtosRaw.map(({ colors: _c, ...p }) => p);
  const { error: pE } = await supabase.from('products').upsert(produtos, { onConflict:'sku' });
  if (pE) { console.error('Produtos:', pE.message); return; }
  const { data: dbProds } = await supabase.from('products').select('id,slug,name,sku');
  const prodBySku = Object.fromEntries(dbProds.map(p => [p.sku, p]));
  console.log(`✅  ${dbProds.length} produtos`);

  // Estoque por tamanho + cor
  let stockRows = 0;
  for (const p of produtosRaw) {
    const dbProd = prodBySku[p.sku];
    if (!dbProd) continue;
    const rows = [];
    for (const colorName of p.colors) {
      for (const [size, qty] of Object.entries(ESTOQUE_PADRAO)) {
        rows.push({
          product_id: dbProd.id,
          size,
          color_id: colorMap[colorName] || null,
          color_name: colorName,
          sku_variant: `${p.sku}-${colorName.slice(0,3).toUpperCase()}-${size}`,
          quantity: qty,
        });
      }
    }
    if (rows.length) {
      await supabase.from('product_variant_stock').upsert(rows, { onConflict:'product_id,size,color_name' });
      stockRows += rows.length;
    }
  }
  console.log(`✅  ${stockRows} combinações de estoque (produto + tamanho + cor)`);

  // Guia de medidas (produtos femininos adultos, como exemplo)
  let guideRows = 0;
  for (const p of produtosRaw) {
    const dbProd = prodBySku[p.sku];
    if (!dbProd) continue;
    const isFeminino = p.category_id === catMap['feminino-blusas'] || p.category_id === catMap['feminino-calcas'] || p.category_id === catMap['feminino-vestidos'];
    if (!isFeminino) continue;
    const rows = SIZE_GUIDE_ADULT.map((r, i) => ({ ...r, product_id: dbProd.id, sort_order: i + 1 }));
    await supabase.from('size_guide_entries').upsert(rows, { onConflict:'product_id,size' });
    guideRows += rows.length;
  }
  console.log(`✅  ${guideRows} linhas de guia de medidas`);

  // Placeholders de imagem
  let imgCount = 0;
  for (const prod of dbProds) {
    const { data: ex } = await supabase.from('product_images').select('id').eq('product_id', prod.id).limit(1);
    if (!ex?.length) {
      await supabase.from('product_images').insert({ product_id: prod.id, url: '/assets/images/placeholder.jpg', alt: prod.name, sort_order: 0, is_cover: true });
      imgCount++;
    }
  }
  console.log(`✅  ${imgCount} placeholders de imagem`);

  // Cupons
  await supabase.from('coupons').upsert([
    { code:'LASTORE10',  type:'percent', value:10, min_order:0,   active:true },
    { code:'LASTORE15',  type:'percent', value:15, min_order:200, active:true },
    { code:'BEMVINDO',   type:'percent', value:5,  min_order:0,   active:true },
    { code:'FRETEGRATIS',type:'fixed',   value:25, min_order:250, active:true },
  ], { onConflict:'code' });
  console.log('✅  4 cupons');

  // Banners
  await supabase.from('banners').upsert([
    { position:'hero', eyebrow:'Coleção 2026', title:'L.A. STORE — Moda que combina com você.', subtitle:'BIAMAR, ANSELMI e outras marcas selecionadas em uma boutique multimarcas.', cta_label:'Comprar agora', cta_url:'/pages/loja.html', active:true, sort_order:1 },
    { position:'cta_banner', title:'Dúvidas sobre tamanho ou cor?', subtitle:'Fale com a gente pelo WhatsApp e receba ajuda para escolher a peça certa.', cta_label:'Falar no WhatsApp', cta_url:'https://wa.me/5500000000000', active:true, sort_order:1 },
  ], { onConflict:'position' });
  console.log('✅  2 banners');

  // Admin
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
  await supabase.from('users').upsert([{ name:'Admin L.A. STORE', email: process.env.ADMIN_EMAIL || 'admin@lastore.com.br', password: hash, role:'admin' }], { onConflict:'email' });
  console.log('✅  Admin\n');

  console.log('═'.repeat(45));
  console.log('🎉  Seed concluído!');
  console.log(`    Login admin: ${process.env.ADMIN_EMAIL || 'admin@lastore.com.br'}`);
  console.log('    Estes produtos são EXEMPLOS — edite/substitua pelo catálogo real no painel.');
  console.log('═'.repeat(45));
}

seed().catch(console.error);
