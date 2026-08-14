-- ============================================================
-- MIGRATION: Sistema de Personalização de Produtos — L.A. STORE
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. COLUNAS DE PERSONALIZAÇÃO NA TABELA products
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allow_customization  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_colors         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_marble         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_metallic       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metallic_price       NUMERIC(10,2) DEFAULT 15.00;

-- ============================================================
-- 2. TABELA DE CORES GLOBAIS (administrável pelo painel)
-- ============================================================
CREATE TABLE IF NOT EXISTS customization_colors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  hex        TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cores padrão
INSERT INTO customization_colors (name, hex, sort_order) VALUES
  ('Branco',       '#F9F7F4', 1),
  ('Bege',         '#E8DFD0', 2),
  ('Areia',        '#C9B99A', 3),
  ('Cinza Claro',  '#C0BBB4', 4),
  ('Cinza Escuro', '#6B6560', 5),
  ('Preto',        '#2C2A26', 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. TABELA: CORES DISPONÍVEIS POR PRODUTO
-- ============================================================
CREATE TABLE IF NOT EXISTS product_available_colors (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  color_id   UUID REFERENCES customization_colors(id) ON DELETE CASCADE,
  UNIQUE(product_id, color_id)
);
CREATE INDEX IF NOT EXISTS idx_pac_product ON product_available_colors(product_id);

-- ============================================================
-- 4. COLUNAS DE PERSONALIZAÇÃO NA TABELA order_items
-- ============================================================
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_color      TEXT,
  ADD COLUMN IF NOT EXISTS marble_enabled      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metallic_type       TEXT CHECK (metallic_type IN ('none','ouro','prata','rose_gold') OR metallic_type IS NULL),
  ADD COLUMN IF NOT EXISTS customization_price NUMERIC(10,2) DEFAULT 0;

-- ============================================================
-- 5. REGRA: Produtos da categoria "Velas" sem personalização
--    (aplicar após insert se categoria existir)
-- ============================================================
UPDATE products
SET allow_customization = false,
    allow_colors        = false,
    allow_marble        = false,
    allow_metallic      = false
WHERE category_id IN (
  SELECT id FROM categories WHERE slug = 'velas'
);
