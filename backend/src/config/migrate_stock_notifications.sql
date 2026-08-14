-- ============================================================
-- [DESATIVADO] Notificações de Retorno ao Estoque — L.A. STORE
--
-- Este recurso foi REMOVIDO do produto (backend/frontend não o usam mais).
-- Este script é mantido apenas como referência histórica de schema.
-- Se a tabela abaixo já existir no seu banco, ela é inofensiva e pode ser
-- removida manualmente com: DROP TABLE IF EXISTS stock_notifications;
-- ============================================================

-- ============================================================
-- MIGRATION: Notificações de Retorno ao Estoque — L.A. STORE
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. TABELA: stock_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT,
  email       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','notified','cancelled')),
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_stock_notif_product   ON stock_notifications(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_notif_user      ON stock_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_notif_status     ON stock_notifications(status);
CREATE INDEX IF NOT EXISTS idx_stock_notif_email      ON stock_notifications(email);

-- ============================================================
-- 2. PREVENÇÃO DE DUPLICIDADE
-- Um e-mail só pode ter UMA notificação ativa (pending) por produto.
-- Usamos índice único parcial para permitir re-cadastro após cancelamento
-- ou após já ter sido notificado (ex: esgotou de novo).
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notif_unique_pending
  ON stock_notifications (product_id, email)
  WHERE status = 'pending';

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;

-- A API usa a service_role key (bypassa RLS), então estas policies
-- são uma camada extra de proteção caso o acesso direto via client
-- anon/authenticated seja usado no futuro.
DROP POLICY IF EXISTS "stock_notifications_service_only" ON stock_notifications;
CREATE POLICY "stock_notifications_service_only" ON stock_notifications
  FOR ALL USING (auth.role() = 'service_role');
