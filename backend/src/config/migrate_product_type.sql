-- ============================================================
-- Migration: Tipo de Produto (Estoque vs Sob Encomenda)
-- L.A. STORE — Executar uma vez no Supabase
-- ============================================================

-- 1. Adiciona coluna product_type na tabela products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'made_to_order'
    CHECK (product_type IN ('stock', 'made_to_order'));

-- 2. Índice para filtros no painel admin
CREATE INDEX IF NOT EXISTS idx_products_type ON products (product_type);

-- 3. Migração automática: Velas = estoque, demais = sob encomenda
UPDATE products
SET product_type = 'stock'
WHERE category_id IN (
  SELECT id FROM categories WHERE slug = 'velas'
);

UPDATE products
SET product_type = 'made_to_order'
WHERE category_id NOT IN (
  SELECT id FROM categories WHERE slug = 'velas'
)
OR category_id IS NULL;

-- 4. Adiciona product_type nos itens do pedido (para histórico)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'made_to_order'
    CHECK (product_type IN ('stock', 'made_to_order'));

-- 5. Back-fill: itens de pedidos com velas = stock
UPDATE order_items oi
SET product_type = 'stock'
WHERE oi.product_id IN (
  SELECT p.id FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = 'velas'
);

-- 6. Índice para filtros de pedidos por tipo de produto
CREATE INDEX IF NOT EXISTS idx_order_items_product_type ON order_items (product_type);
