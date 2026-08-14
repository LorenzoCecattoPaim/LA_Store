-- ============================================================
-- L.A. STORE — Migration: Lançamentos
-- ============================================================

-- Tabela principal de lançamentos
CREATE TABLE IF NOT EXISTS launches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  subtitle      TEXT,
  description   TEXT,
  slug          TEXT UNIQUE NOT NULL,
  cover_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','scheduled','hidden')),
  featured_home BOOLEAN DEFAULT false,
  sort_order    INT DEFAULT 0,
  published_at  TIMESTAMPTZ,
  meta_title    TEXT,
  meta_desc     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launches_slug    ON launches(slug);
CREATE INDEX IF NOT EXISTS idx_launches_status  ON launches(status);
CREATE INDEX IF NOT EXISTS idx_launches_home    ON launches(featured_home);
CREATE INDEX IF NOT EXISTS idx_launches_order   ON launches(sort_order);

-- Tabela de relacionamento: lançamento ↔ produto
CREATE TABLE IF NOT EXISTS launch_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id   UUID REFERENCES launches(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  sort_order  INT DEFAULT 0,
  UNIQUE(launch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_launch_products_launch   ON launch_products(launch_id);
CREATE INDEX IF NOT EXISTS idx_launch_products_product  ON launch_products(product_id);

-- Trigger updated_at para launches
DO $$ BEGIN
  CREATE TRIGGER trg_launches_updated
    BEFORE UPDATE ON launches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
