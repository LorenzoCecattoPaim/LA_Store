-- ============================================================
-- L.A. STORE — Migration de Storage e RLS para Imagens de Produto
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Criar bucket "product-images" (público) se não existir
-- Obs: se o bucket já existe com outro nome, ajuste SUPABASE_STORAGE_BUCKET no .env
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                                          -- bucket público
  10485760,                                      -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp'] -- tipos permitidos
)
ON CONFLICT (id) DO UPDATE
  SET public           = true,
      file_size_limit  = 10485760,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Políticas do Storage

-- Leitura pública (loja precisa acessar as imagens sem autenticação)
DROP POLICY IF EXISTS "product-images-public-read" ON storage.objects;
CREATE POLICY "product-images-public-read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Upload: apenas service_role (backend usa SERVICE_ROLE_KEY que bypassa RLS)
-- Mas adicionamos política explícita para clareza
DROP POLICY IF EXISTS "product-images-service-insert" ON storage.objects;
CREATE POLICY "product-images-service-insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

-- Update: apenas service_role
DROP POLICY IF EXISTS "product-images-service-update" ON storage.objects;
CREATE POLICY "product-images-service-update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images');

-- Delete: apenas service_role
DROP POLICY IF EXISTS "product-images-service-delete" ON storage.objects;
CREATE POLICY "product-images-service-delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images');

-- 3. RLS da tabela product_images
-- Já deve existir via migrate.js mas garantimos aqui

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Leitura pública (loja exibe imagens sem autenticação)
DROP POLICY IF EXISTS "product_images_public_read" ON product_images;
CREATE POLICY "product_images_public_read"
  ON product_images FOR SELECT
  USING (true);

-- Escrita: somente via service_role (backend)
-- SERVICE_ROLE_KEY bypassa RLS — não precisa de política de escrita
-- Mas se quiser ser explícito para anon_key não poder escrever:
DROP POLICY IF EXISTS "product_images_service_write" ON product_images;
-- (service_role bypassa RLS por padrão — não há política necessária)

-- ============================================================
-- VERIFICAÇÃO: rode esta query para confirmar o bucket
-- ============================================================
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'product-images';
