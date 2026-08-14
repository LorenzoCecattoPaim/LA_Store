/**
 * L.A. STORE — Schema SQL completo para Supabase
 * Execute: node src/config/migrate.js
 * Ou cole o SQL abaixo diretamente no SQL Editor do Supabase
 *
 * Este arquivo:
 *  1. Cria todas as tabelas (se não existirem)
 *  2. Remove categorias e produtos fictícios antigos
 *  3. Garante compatibilidade total com o schema existente
 *
 * IMPORTANTE: depois de rodar este script, rode também
 * migrate_fashion_variants.sql (marcas, categorias de moda,
 * cores, tamanhos e estoque por variação) e depois seed_fashion.js.
 */

require('dotenv').config();
const supabase = require('./supabase');

const SQL = `
-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USUÁRIOS / CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  active      BOOLEAN DEFAULT true,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- ENDEREÇOS
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT DEFAULT 'Casa',
  name         TEXT NOT NULL,
  zip          TEXT NOT NULL,
  street       TEXT NOT NULL,
  number       TEXT NOT NULL,
  complement   TEXT,
  neighborhood TEXT NOT NULL,
  city         TEXT NOT NULL,
  state        CHAR(2) NOT NULL,
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ============================================================
-- CATEGORIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT DEFAULT 0,
  active      BOOLEAN DEFAULT true
);

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku             TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  category_id     UUID REFERENCES categories(id),
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_pix       NUMERIC(10,2),
  description     TEXT,
  material        TEXT,
  dimensions      TEXT,
  weight          TEXT,
  finish          TEXT,
  production_days INT DEFAULT 7,
  stock           INT NOT NULL DEFAULT 0,
  badge           TEXT,
  active          BOOLEAN DEFAULT true,
  featured        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);

-- ============================================================
-- IMAGENS DE PRODUTO
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT,
  sort_order  INT DEFAULT 0,
  is_cover    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ============================================================
-- VARIANTES (acabamento / tamanho / quantidade)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('color','size','finish','quantity')),
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  hex         TEXT,
  price_delta NUMERIC(10,2) DEFAULT 0,
  sort_order  INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- ============================================================
-- CUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value       NUMERIC(10,2) NOT NULL,
  min_order   NUMERIC(10,2) DEFAULT 0,
  max_uses    INT,
  used_count  INT DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL,
  user_id           UUID REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','in_production','shipped','delivered','cancelled','refunded')),
  payment_method    TEXT NOT NULL,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_id        TEXT,
  subtotal          NUMERIC(10,2) NOT NULL,
  discount          NUMERIC(10,2) DEFAULT 0,
  shipping_cost     NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  coupon_id         UUID REFERENCES coupons(id),
  coupon_code       TEXT,
  ship_name         TEXT,
  ship_zip          TEXT,
  ship_street       TEXT,
  ship_number       TEXT,
  ship_complement   TEXT,
  ship_neighborhood TEXT,
  ship_city         TEXT,
  ship_state        CHAR(2),
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT,
  tracking_code     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number  ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ============================================================
-- ITENS DO PEDIDO
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_name  TEXT NOT NULL,
  product_sku   TEXT,
  variant_color TEXT,
  variant_size  TEXT,
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,
  total_price   NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================
-- AVALIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  order_id    UUID REFERENCES orders(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  body        TEXT,
  approved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- ============================================================
-- NEWSLETTER
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT UNIQUE NOT NULL,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position   TEXT NOT NULL,
  title      TEXT,
  subtitle   TEXT,
  eyebrow    TEXT,
  cta_label  TEXT,
  cta_url    TEXT,
  active     BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- COLUNA price_delta em product_variants (caso não exista)
-- ============================================================
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS price_delta NUMERIC(10,2) DEFAULT 0;

-- Atualiza o CHECK de type para aceitar 'finish' e 'quantity'
-- (Supabase/PostgreSQL: remove e recria o constraint com segurança)
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_type_check;
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_type_check
  CHECK (type IN ('color','size','finish','quantity'));

-- ============================================================
-- LIMPEZA: remove produtos e categorias fictícios antigos
-- ============================================================

-- Remove variantes dos produtos fictícios
DELETE FROM product_variants
WHERE product_id IN (
  SELECT id FROM products
  WHERE slug IN (
    'vaso-bruto-12','bandeja-cimento','esfera-duo','kit-decorisa',
    'vaso-slim','bandeja-retangular','vaso-bowl','peca-personalizada'
  )
);

-- Remove imagens dos produtos fictícios
DELETE FROM product_images
WHERE product_id IN (
  SELECT id FROM products
  WHERE slug IN (
    'vaso-bruto-12','bandeja-cimento','esfera-duo','kit-decorisa',
    'vaso-slim','bandeja-retangular','vaso-bowl','peca-personalizada'
  )
);

-- Remove produtos fictícios
DELETE FROM products
WHERE slug IN (
  'vaso-bruto-12','bandeja-cimento','esfera-duo','kit-decorisa',
  'vaso-slim','bandeja-retangular','vaso-bowl','peca-personalizada'
);

-- Remove categorias que não existem mais no catálogo real
DELETE FROM categories
WHERE slug IN ('esferas','kits','personalizados');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews     ENABLE ROW LEVEL SECURITY;
`;

async function migrate() {
  console.log('⏳  Executando migration L.A. STORE...\n');

  // Tenta executar via RPC (requer função exec_sql no Supabase)
  const { error } = await supabase
    .rpc('exec_sql', { sql: SQL })
    .catch(() => ({ error: 'rpc_not_available' }));

  if (error === 'rpc_not_available' || error) {
    console.log('━'.repeat(60));
    console.log('📋  Cole o SQL abaixo no SQL Editor do Supabase:');
    console.log('    https://supabase.com/dashboard → SQL Editor → New Query\n');
    console.log(SQL);
    console.log('━'.repeat(60));
    console.log('\n✅  Após executar o SQL, rode migrate_fashion_variants.sql');
    console.log('    e depois:  node src/config/seed_fashion.js\n');
  } else {
    console.log('✅  Migration aplicada com sucesso!');
    console.log('    Próximo passo: cole migrate_fashion_variants.sql no SQL Editor,');
    console.log('    depois rode: node src/config/seed_fashion.js\n');
  }
}

migrate().catch(console.error);
