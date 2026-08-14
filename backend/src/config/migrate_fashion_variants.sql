-- ============================================================
-- MIGRATION: Modelo de Moda — L.A. STORE
-- Marcas · Categorias hierárquicas · Cores · Tamanhos ·
-- Estoque por variação (produto + tamanho + cor) · Guia de medidas
--
-- Execute no SQL Editor do Supabase DEPOIS de rodar migrate.js.
-- Este script é idempotente (pode ser executado mais de uma vez).
-- Ele NÃO apaga o sistema antigo de "customização" (mármore/metálico)
-- — essas colunas ficam sem uso, mas preservadas por segurança.
-- ============================================================

-- ============================================================
-- 1. MARCAS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  description TEXT,
  logo_url   TEXT,
  sort_order INT DEFAULT 0,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO brands (slug, name, sort_order) VALUES
  ('biamar',  'BIAMAR',  1),
  ('anselmi', 'ANSELMI', 2)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

-- ============================================================
-- 2. CATEGORIAS HIERÁRQUICAS (Feminino/Masculino/Infantil > subcategorias)
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Categorias-mãe
INSERT INTO categories (slug, name, description, sort_order) VALUES
  ('feminino',  'Feminino',  'Moda feminina L.A. STORE',            1),
  ('masculino', 'Masculino', 'Moda masculina L.A. STORE',           2),
  ('infantil',  'Infantil',  'L.A. STORE KIDS — moda infantil',     3)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorias — Feminino
INSERT INTO categories (slug, name, sort_order, parent_id)
SELECT slug, name, sort_order, (SELECT id FROM categories WHERE slug='feminino')
FROM (VALUES
  ('feminino-blusas',    'Blusas',     1),
  ('feminino-calcas',    'Calças',     2),
  ('feminino-vestidos',  'Vestidos',   3),
  ('feminino-saias',     'Saias',      4),
  ('feminino-shorts',    'Shorts',     5),
  ('feminino-jaquetas',  'Jaquetas',   6),
  ('feminino-casacos',   'Casacos',    7),
  ('feminino-tricos',    'Tricôs',     8),
  ('feminino-conjuntos', 'Conjuntos',  9),
  ('feminino-acessorios','Acessórios', 10)
) AS t(slug, name, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorias — Masculino
INSERT INTO categories (slug, name, sort_order, parent_id)
SELECT slug, name, sort_order, (SELECT id FROM categories WHERE slug='masculino')
FROM (VALUES
  ('masculino-camisetas','Camisetas', 1),
  ('masculino-camisas',  'Camisas',   2),
  ('masculino-calcas',   'Calças',    3),
  ('masculino-bermudas', 'Bermudas',  4),
  ('masculino-jaquetas', 'Jaquetas',  5),
  ('masculino-casacos',  'Casacos',   6),
  ('masculino-tricos',   'Tricôs',    7),
  ('masculino-acessorios','Acessórios',8)
) AS t(slug, name, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorias — Infantil (L.A. STORE KIDS)
INSERT INTO categories (slug, name, sort_order, parent_id)
SELECT slug, name, sort_order, (SELECT id FROM categories WHERE slug='infantil')
FROM (VALUES
  ('infantil-bebe',    'Bebê',     1),
  ('infantil-infantil','Infantil', 2),
  ('infantil-juvenil', 'Juvenil',  3),
  ('infantil-meninas', 'Meninas',  4),
  ('infantil-meninos', 'Meninos',  5)
) AS t(slug, name, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. CORES (catálogo global administrável)
-- ============================================================
CREATE TABLE IF NOT EXISTS colors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT UNIQUE NOT NULL,
  hex        TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO colors (name, hex, sort_order) VALUES
  ('Preto',      '#141414', 1),
  ('Branco',     '#FFFFFF', 2),
  ('Off-white',  '#F4F1EA', 3),
  ('Bege',       '#D8C7AC', 4),
  ('Azul',       '#33445E', 5),
  ('Verde',      '#4A5C45', 6),
  ('Marrom',     '#5A4634', 7),
  ('Grafite',    '#3A3A38', 8)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. TAMANHOS (catálogo global de sugestão — o admin pode digitar
--    qualquer valor por produto, esta tabela é só um atalho)
-- ============================================================
CREATE TABLE IF NOT EXISTS sizes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT UNIQUE NOT NULL,
  sort_order INT DEFAULT 0,
  active     BOOLEAN DEFAULT true
);

INSERT INTO sizes (label, sort_order) VALUES
  ('PP', 1), ('P', 2), ('M', 3), ('G', 4), ('GG', 5), ('XG', 6),
  ('36', 10), ('38', 11), ('40', 12), ('42', 13), ('44', 14), ('46', 15),
  ('Único', 20)
ON CONFLICT (label) DO NOTHING;

-- ============================================================
-- 5. ESTOQUE POR VARIAÇÃO — produto + tamanho + cor
--    Esta é a peça central do modelo de moda.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variant_stock (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT NOT NULL,
  color_id    UUID REFERENCES colors(id),
  color_name  TEXT NOT NULL,          -- desnormalizado: nome da cor no momento do cadastro
  sku_variant TEXT,                    -- SKU específico da combinação (opcional)
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, size, color_name)
);
CREATE INDEX IF NOT EXISTS idx_pvs_product ON product_variant_stock(product_id);

DO $$ BEGIN
  CREATE TRIGGER trg_pvs_updated
    BEFORE UPDATE ON product_variant_stock FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reserva temporária de estoque durante o checkout (evita overselling
-- em concorrência — expira sozinha, ver rota orders/checkout).
CREATE TABLE IF NOT EXISTS stock_reservations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_stock_id UUID REFERENCES product_variant_stock(id) ON DELETE CASCADE,
  quantity       INT NOT NULL,
  session_id     TEXT,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_variant ON stock_reservations(variant_stock_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON stock_reservations(expires_at);

-- ============================================================
-- 6. GUIA DE MEDIDAS — tabela por produto (ou reaproveitável por categoria)
-- ============================================================
CREATE TABLE IF NOT EXISTS size_guide_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT NOT NULL,
  bust_cm     NUMERIC(5,1),   -- busto
  waist_cm    NUMERIC(5,1),   -- cintura
  hip_cm      NUMERIC(5,1),   -- quadril
  sort_order  INT DEFAULT 0,
  UNIQUE (product_id, size)
);
CREATE INDEX IF NOT EXISTS idx_size_guide_product ON size_guide_entries(product_id);

-- ============================================================
-- 7. PRODUTOS — colunas de moda (mantendo as antigas por compatibilidade)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS composition   TEXT,   -- "96% Poliéster, 4% Elastano"
  ADD COLUMN IF NOT EXISTS care_instructions TEXT, -- "Lavar à mão, não usar alvejante"
  ADD COLUMN IF NOT EXISTS promo_price   NUMERIC(10,2); -- preço promocional (além de price_pix)

-- ============================================================
-- 8. ITENS DO PEDIDO — referência à variação exata comprada
-- ============================================================
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_stock_id UUID REFERENCES product_variant_stock(id);

-- ============================================================
-- 9. RLS — leitura pública das tabelas novas, escrita restrita ao backend
--    (o backend usa a service_role key, que ignora RLS; isso é só para
--    proteger contra acesso direto de clientes via anon key, se algum dia
--    for usado no frontend)
-- ============================================================
ALTER TABLE brands                ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_guide_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY brands_public_read  ON brands  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY colors_public_read  ON colors  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sizes_public_read   ON sizes   FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY pvs_public_read     ON product_variant_stock FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY size_guide_public_read ON size_guide_entries FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FIM — depois de rodar este script, rode:
--   node src/config/seed_fashion.js
-- para popular marcas/categorias com produtos de exemplo.
-- ============================================================
