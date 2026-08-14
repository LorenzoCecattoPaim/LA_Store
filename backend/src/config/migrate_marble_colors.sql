-- ============================================================
-- MIGRATION: Cores do Marmorizado — L.A. STORE
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. SUBSTITUIR cores padrão das peças (customization_colors)
--    Remove antigas e insere as novas 10 cores padrão
-- ============================================================

-- Limpa cores antigas (apenas as do seed padrão, preservando customizadas)
DELETE FROM customization_colors
WHERE name IN ('Branco','Bege','Areia','Cinza Claro','Cinza Escuro','Preto')
  AND id NOT IN (SELECT color_id FROM product_available_colors);

-- Insere (ou atualiza) as 10 cores padrão das peças lisas
INSERT INTO customization_colors (name, hex, sort_order, active) VALUES
  ('Branco',   '#F9F7F4', 1,  true),
  ('Bege',     '#E8D9C0', 2,  true),
  ('Cinza',    '#A8A49F', 3,  true),
  ('Marrom',   '#7B5534', 4,  true),
  ('Rosa',     '#E8A0B0', 5,  true),
  ('Laranja',  '#E8885A', 6,  true),
  ('Amarelo',  '#E8D55A', 7,  true),
  ('Verde',    '#6AAE78', 8,  true),
  ('Azul',     '#4A78D0', 9,  true),
  ('Roxo',     '#8B5FBF', 10, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. TABELA DE CORES DO MARMORIZADO
-- ============================================================
CREATE TABLE IF NOT EXISTS marble_colors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  hex        TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cores padrão do marmorizado
INSERT INTO marble_colors (name, hex, sort_order, active) VALUES
  ('Branco',   '#F9F7F4', 1,  true),
  ('Creme',    '#F0E6C8', 2,  true),
  ('Cinza',    '#A8A49F', 3,  true),
  ('Rosa',     '#E8A0B0', 4,  true),
  ('Laranja',  '#E8885A', 5,  true),
  ('Amarelo',  '#E8D55A', 6,  true),
  ('Verde',    '#6AAE78', 7,  true),
  ('Azul',     '#4A78D0', 8,  true),
  ('Roxo',     '#8B5FBF', 9,  true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. TABELA: CORES DE MARMORIZADO DISPONÍVEIS POR PRODUTO
-- ============================================================
CREATE TABLE IF NOT EXISTS product_available_marble_colors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  color_id   UUID REFERENCES marble_colors(id) ON DELETE CASCADE,
  UNIQUE(product_id, color_id)
);
CREATE INDEX IF NOT EXISTS idx_pamc_product ON product_available_marble_colors(product_id);

-- ============================================================
-- 4. ADICIONAR CAMPO marble_color NA TABELA order_items
-- ============================================================
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS marble_color TEXT;
