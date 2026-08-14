-- Migration: Add store pickup (retirada na loja) support to orders
-- Run once against your Supabase project

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'delivery'
    CHECK (delivery_method IN ('delivery', 'pickup')),
  ADD COLUMN IF NOT EXISTS pickup_address  TEXT;

-- Index for filtering pickup orders in admin
CREATE INDEX IF NOT EXISTS idx_orders_delivery_method ON orders (delivery_method);

-- Back-fill existing rows (all previous orders = delivery)
UPDATE orders SET delivery_method = 'delivery' WHERE delivery_method IS NULL;
