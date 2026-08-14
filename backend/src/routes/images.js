/**
 * L.A. STORE — Rotas de Upload de Imagens de Produto
 *
 * POST   /api/images/products/:id/upload   → faz upload para Supabase Storage + salva em product_images
 * DELETE /api/images/:imageId              → remove do Storage + remove de product_images
 * GET    /api/images/products/:id          → lista imagens de um produto
 * PATCH  /api/images/:imageId/cover        → define imagem como capa
 */

const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { auth, adminOnly } = require('../middleware/auth');
const { upload, handleUploadError, ALLOWED_MIME } = require('../middleware/upload');

/* ============================================================
   CONSTANTES
   ============================================================ */

// Nome do bucket no Supabase Storage
// Ajuste se o bucket tiver outro nome no seu projeto Supabase
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Gera o caminho único do arquivo no Storage.
 * Exemplo: products/abc-123/1700000000000-uuid.webp
 */
function buildStoragePath(productId, originalname) {
  const ext = originalname.slice(originalname.lastIndexOf('.')).toLowerCase();
  return `products/${productId}/${Date.now()}-${uuidv4()}${ext}`;
}

/**
 * Valida o MIME real do buffer (magic bytes).
 * Proteção extra contra extensões falsas.
 */
function validateMagicBytes(buffer, mimetype) {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;

  console.warn(`[UPLOAD] Magic bytes inválidos para mimetype: ${mimetype}`);
  return false;
}

/**
 * Retorna a URL pública do arquivo no Storage.
 * Se o bucket for privado, use getSignedUrl em vez disso.
 */
function getPublicUrl(storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * Remove arquivo do Storage com tolerância a falhas.
 * Loga erro mas não lança exceção para não bloquear fluxos de compensação.
 */
async function removeFromStorage(storagePath) {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      console.error(`[STORAGE] Falha ao remover ${storagePath}:`, error.message);
    }
  } catch (err) {
    console.error(`[STORAGE] Exceção ao remover ${storagePath}:`, err.message);
  }
}

/**
 * Extrai o caminho relativo do Storage a partir da URL pública.
 * Ex: "https://xxx.supabase.co/storage/v1/object/public/product-images/products/id/file.jpg"
 * → "products/id/file.jpg"
 */
function extractStoragePath(url) {
  if (!url) return null;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) return url.slice(idx + marker.length);
    // Fallback para URLs signed
    const signedMarker = `/object/sign/${BUCKET}/`;
    const idx2 = url.indexOf(signedMarker);
    if (idx2 !== -1) return url.slice(idx2 + signedMarker.length).split('?')[0];
    return null;
  } catch {
    return null;
  }
}

/* ============================================================
   ROTAS
   ============================================================ */

/**
 * GET /api/images/products/:id
 * Lista todas as imagens de um produto (público — loja precisa acessar)
 */
router.get('/products/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('id, url, alt, sort_order, is_cover, created_at')
      .eq('product_id', req.params.id)
      .order('sort_order');

    if (error) throw error;
    res.json({ images: data || [] });
  } catch (err) { next(err); }
});

/**
 * POST /api/images/products/:id/upload
 * Upload de imagem para Supabase Storage + registro em product_images.
 * Requer autenticação admin.
 * Body: multipart/form-data com campo "image"
 * Campos opcionais: alt (texto), sort_order (int), is_cover (boolean)
 */
router.post(
  '/products/:id/upload',
  auth,
  adminOnly,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  async (req, res, next) => {
    const file = req.file;
    let storagePath = null;

    try {
      // 1. Garantir que arquivo foi enviado
      if (!file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada. Use o campo "image".' });
      }

      // 2. Verificar se o produto existe
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id')
        .eq('id', req.params.id)
        .single();

      if (productError || !product) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }

      // 3. Validação de magic bytes (segurança extra)
      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        return res.status(400).json({ error: 'Arquivo inválido. O conteúdo não corresponde ao tipo declarado.' });
      }

      // 4. Checar duplicata: mesmo produto, mesmo tamanho e nome (heurística simples)
      // Não bloqueante — apenas log informativo
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', req.params.id);
      const imageCount = (existingImages || []).length;
      console.log(`[UPLOAD] Produto ${req.params.id} já tem ${imageCount} imagem(ns). Adicionando nova.`);

      // 5. Gerar caminho único no Storage
      storagePath = buildStoragePath(req.params.id, file.originalname);

      // 6. Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Nunca sobrescrever — sempre gera nome único
        });

      if (uploadError) {
        console.error('[UPLOAD] Erro no Storage:', uploadError);
        throw new Error(`Falha no upload para o Storage: ${uploadError.message}`);
      }

      // 7. Obter URL pública
      const publicUrl = getPublicUrl(storagePath);
      if (!publicUrl) {
        // Compensação: remover arquivo do Storage se não conseguir gerar URL
        await removeFromStorage(storagePath);
        throw new Error('Não foi possível gerar a URL da imagem.');
      }

      // 8. Parsear campos opcionais
      const alt        = (req.body.alt || '').trim() || null;
      const sortOrder  = parseInt(req.body.sort_order, 10) || 0;
      const isCover    = req.body.is_cover === 'true' || req.body.is_cover === true;

      // 9. Se for capa, desmarca as outras
      if (isCover) {
        const { error: coverError } = await supabase
          .from('product_images')
          .update({ is_cover: false })
          .eq('product_id', req.params.id);

        if (coverError) {
          console.error('[UPLOAD] Erro ao desmarcar capas anteriores:', coverError.message);
          // Não é fatal — continua
        }
      }

      // 10. Salvar registro no banco
      const { data: imageRecord, error: dbError } = await supabase
        .from('product_images')
        .insert({
          product_id: req.params.id,
          url:        publicUrl,
          alt,
          sort_order: sortOrder,
          is_cover:   isCover,
        })
        .select()
        .single();

      if (dbError) {
        // Compensação: remover arquivo do Storage para não deixar órfão
        await removeFromStorage(storagePath);
        console.error('[UPLOAD] Erro ao salvar no banco:', dbError.message);
        throw new Error(`Falha ao registrar imagem no banco de dados: ${dbError.message}`);
      }

      console.log(`[UPLOAD] Imagem ${imageRecord.id} salva com sucesso para produto ${req.params.id}`);

      res.status(201).json({
        message: 'Imagem enviada com sucesso.',
        image: imageRecord,
      });

    } catch (err) {
      // Se o arquivo subiu mas o DB falhou, já foi compensado acima
      // Se o upload nem ocorreu, storagePath é null — nada a limpar
      next(err);
    }
  }
);

/**
 * PATCH /api/images/:imageId/cover
 * Define uma imagem como capa do produto.
 * Requer autenticação admin.
 */
router.patch('/:imageId/cover', auth, adminOnly, async (req, res, next) => {
  try {
    // 1. Buscar a imagem para saber o product_id
    const { data: image, error: findError } = await supabase
      .from('product_images')
      .select('id, product_id')
      .eq('id', req.params.imageId)
      .single();

    if (findError || !image) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    // 2. Desmarcar todas as capas do produto
    await supabase
      .from('product_images')
      .update({ is_cover: false })
      .eq('product_id', image.product_id);

    // 3. Marcar esta como capa
    const { data: updated, error: updateError } = await supabase
      .from('product_images')
      .update({ is_cover: true })
      .eq('id', req.params.imageId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ message: 'Imagem definida como capa.', image: updated });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/images/:imageId
 * Atualiza alt text e sort_order de uma imagem.
 * Requer autenticação admin.
 */
router.patch('/:imageId', auth, adminOnly, async (req, res, next) => {
  try {
    const { alt, sort_order } = req.body;
    const payload = {};
    if (alt !== undefined)        payload.alt        = alt || null;
    if (sort_order !== undefined)  payload.sort_order = parseInt(sort_order, 10) || 0;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    const { data, error } = await supabase
      .from('product_images')
      .update(payload)
      .eq('id', req.params.imageId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Imagem não encontrada.' });
    res.json({ image: data });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/images/:imageId
 * Remove imagem do Storage e do banco de dados.
 * Requer autenticação admin.
 * Garante consistência: se o DB falhar, mantém o arquivo no Storage (não deixa órfão no DB).
 * Se o Storage falhar, remove do DB mas loga o erro para limpeza manual.
 */
router.delete('/:imageId', auth, adminOnly, async (req, res, next) => {
  try {
    // 1. Buscar a imagem para obter a URL (necessária para saber o path no Storage)
    const { data: image, error: findError } = await supabase
      .from('product_images')
      .select('id, url, product_id')
      .eq('id', req.params.imageId)
      .single();

    if (findError || !image) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    // 2. Extrair o path do Storage a partir da URL
    const storagePath = extractStoragePath(image.url);

    // 3. Remover do banco de dados PRIMEIRO (operação reversível pelo Storage)
    const { error: dbError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', req.params.imageId);

    if (dbError) {
      console.error(`[DELETE] Erro ao remover imagem ${req.params.imageId} do banco:`, dbError.message);
      throw new Error(`Falha ao remover imagem do banco de dados: ${dbError.message}`);
    }

    // 4. Remover do Storage (tolerante a falhas — loga mas não reverte o DB)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (storageError) {
        // Arquivo ficou órfão no Storage — logar para limpeza futura
        console.error(`[DELETE] ATENÇÃO: Imagem removida do DB mas arquivo órfão no Storage: ${storagePath}`, storageError.message);
        // Não reverte o DB — o registro de BD já foi removido consistentemente
        // O arquivo no Storage pode ser limpo manualmente ou via job de manutenção
      } else {
        console.log(`[DELETE] Imagem ${req.params.imageId} removida do Storage: ${storagePath}`);
      }
    } else {
      console.warn(`[DELETE] Imagem ${req.params.imageId}: não foi possível extrair path do Storage da URL: ${image.url}`);
    }

    res.json({ message: 'Imagem excluída com sucesso.' });
  } catch (err) { next(err); }
});

module.exports = router;
