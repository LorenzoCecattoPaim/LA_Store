const supabase = require('../config/supabase');
const mailer   = require('../utils/mailer');

/**
 * Processa notificações de retorno ao estoque.
 *
 * PROTEÇÕES DE CONCORRÊNCIA:
 * - Usa UPDATE atômico com WHERE status='pending' antes de enviar,
 *   reservando os registros para esta execução específica.
 * - Mesmo que dois processos chamem esta função simultaneamente,
 *   apenas um irá reservar e enviar cada notificação.
 *
 * IDEMPOTÊNCIA:
 * - Notificações já 'notified' ou 'cancelled' são ignoradas.
 * - Re-execução sobre o mesmo produto não envia duplicatas.
 *
 * @param {string} productId
 * @param {number} previousStock - estoque anterior (deve ser <= 0)
 * @param {number} currentStock  - estoque atual (deve ser > 0)
 */
async function processBackInStockNotifications(productId, previousStock, currentStock) {
  const tag = '[BACK_IN_STOCK]';
  const startedAt = new Date().toISOString();

  console.log(`${tag} ===== INÍCIO DO PROCESSAMENTO =====`);
  console.log(`${tag} product_id=${productId} previous_stock=${previousStock} current_stock=${currentStock} started_at=${startedAt}`);

  // Validação da transição real (0 → positivo)
  if (Number(previousStock) > 0) {
    console.log(`${tag} SKIP — estoque anterior já era positivo (${previousStock}). Nenhuma notificação necessária.`);
    return;
  }
  if (Number(currentStock) <= 0) {
    console.log(`${tag} SKIP — estoque atual ainda é zero ou negativo (${currentStock}). Nenhuma notificação necessária.`);
    return;
  }

  // Diagnóstico de variáveis de ambiente do mailer (sem expor senhas)
  const envCheck = {
    MAIL_HOST:     !!process.env.MAIL_HOST,
    MAIL_PORT:     !!process.env.MAIL_PORT,
    MAIL_USER:     !!process.env.MAIL_USER,
    MAIL_PASS:     !!process.env.MAIL_PASS,
    MAIL_FROM:     !!process.env.MAIL_FROM,
    FRONTEND_URL:  !!process.env.FRONTEND_URL,
  };

  const missingEnv = Object.entries(envCheck).filter(([, v]) => !v).map(([k]) => k);

  console.log(`${tag} ENV check: ${JSON.stringify(envCheck)}`);

  if (missingEnv.length > 0) {
    // LOG CRÍTICO — não aborta, tenta mesmo assim para registrar o erro real do mailer
    console.error(`${tag} ALERTA — variáveis de ambiente ausentes: ${missingEnv.join(', ')}`);
    console.error(`${tag} Verifique as variáveis no painel do Render / .env`);
    // Não abortamos aqui: deixamos o mailer tentar e logar o erro real de SMTP
  }

  try {
    // 1. Buscar dados do produto com imagens
    console.log(`${tag} [1/7] Buscando dados do produto ${productId}...`);
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, name, slug, stock, images:product_images(url, is_cover)')
      .eq('id', productId)
      .single();

    if (pErr) {
      console.error(`${tag} ERRO ao buscar produto ${productId}:`, pErr.message, pErr.details || '');
      return;
    }
    if (!product) {
      console.error(`${tag} Produto ${productId} não encontrado no banco.`);
      return;
    }

    console.log(`${tag} [1/7] Produto encontrado: "${product.name}" (slug=${product.slug}, stock=${product.stock})`);

    // 2. Buscar notificações pendentes
    console.log(`${tag} [2/7] Buscando notificações pendentes para o produto "${product.name}"...`);
    const { data: pending, error: nErr } = await supabase
      .from('stock_notifications')
      .select('id, name, email')
      .eq('product_id', productId)
      .eq('status', 'pending');

    if (nErr) {
      console.error(`${tag} ERRO ao buscar notificações pendentes:`, nErr.message, nErr.details || '');
      return;
    }

    if (!pending?.length) {
      console.log(`${tag} [2/7] Nenhuma notificação pendente encontrada para o produto "${product.name}". Nada a fazer.`);
      return;
    }

    console.log(`${tag} [2/7] ${pending.length} notificação(ões) pendente(s) para "${product.name}"`);
    pending.forEach(n => console.log(`${tag}   - id=${n.id} email=${n.email} name="${n.name || 'sem nome'}"`));

    // 3. PROTEÇÃO DE CONCORRÊNCIA:
    // Marca atomicamente as notificações como 'notified' ANTES de enviar os e-mails.
    console.log(`${tag} [3/7] Reservando ${pending.length} notificação(ões) atomicamente...`);
    const pendingIds = pending.map(n => n.id);
    const nowIso = new Date().toISOString();

    const { data: reserved, error: rErr } = await supabase
      .from('stock_notifications')
      .update({ status: 'notified', notified_at: nowIso })
      .in('id', pendingIds)
      .eq('status', 'pending')   // WHERE garante idempotência
      .select('id, name, email');

    if (rErr) {
      console.error(`${tag} ERRO ao reservar notificações:`, rErr.message, rErr.details || '');
      return;
    }

    if (!reserved?.length) {
      console.log(`${tag} [3/7] Nenhuma notificação reservada — provavelmente já processadas por outra instância.`);
      return;
    }

    console.log(`${tag} [3/7] ${reserved.length} notificação(ões) reservadas com sucesso.`);

    // 4. Preparar dados do e-mail
    console.log(`${tag} [4/7] Preparando dados do e-mail...`);
    const cover = (product.images || []).find(i => i.is_cover) || product.images?.[0];
    const productUrl = `${process.env.FRONTEND_URL}/pages/produto.html?slug=${product.slug}`;

    console.log(`${tag} [4/7] productUrl=${productUrl} cover=${cover?.url || 'sem imagem'}`);

    // 5. Enviar e-mails para os reservados
    console.log(`${tag} [5/7] Iniciando envio de ${reserved.length} e-mail(s)...`);

    const results = await Promise.allSettled(
      reserved.map(async n => {
        try {
          console.log(`${tag}   → Enviando para ${n.email}...`);
          await mailer.sendStockReplenished({
            to:           n.email,
            name:         n.name || 'Cliente',
            productName:  product.name,
            productImage: cover?.url || null,
            productUrl,
          });
          console.log(`${tag}   ✓ E-mail enviado com sucesso para ${n.email}`);
          return { id: n.id, email: n.email, success: true };
        } catch (mailErr) {
          console.error(`${tag}   ✗ FALHA ao enviar para ${n.email}:`);
          console.error(`${tag}     Código: ${mailErr.code || 'N/A'}`);
          console.error(`${tag}     Mensagem: ${mailErr.message}`);
          if (mailErr.response) console.error(`${tag}     Resposta SMTP: ${mailErr.response}`);
          return { id: n.id, email: n.email, success: false, error: mailErr.message };
        }
      })
    );

    // 6. Processar resultados
    console.log(`${tag} [6/7] Processando resultados...`);
    const succeeded = results
      .filter(r => r.status === 'fulfilled' && r.value?.success)
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success))
      .map(r => r.value)
      .filter(Boolean);

    console.log(`${tag} [6/7] Enviados: ${succeeded.length} | Falhados: ${failed.length}`);

    // 7. Reverter para 'pending' os que falharam (para retry futuro)
    if (failed.length) {
      console.log(`${tag} [7/7] Revertendo ${failed.length} notificação(ões) para 'pending' (retry futuro)...`);
      const failedIds = failed.map(f => f.id).filter(Boolean);
      const { error: revertErr } = await supabase
        .from('stock_notifications')
        .update({ status: 'pending', notified_at: null })
        .in('id', failedIds);

      if (revertErr) {
        console.error(`${tag} [7/7] ERRO ao reverter notificações falhadas:`, revertErr.message);
      } else {
        console.log(`${tag} [7/7] ${failedIds.length} notificação(ões) revertidas para 'pending'.`);
        failed.forEach(f => console.log(`${tag}   - id=${f.id} email=${f.email} erro="${f.error}"`));
      }
    } else {
      console.log(`${tag} [7/7] Todos os e-mails enviados com sucesso. Nada a reverter.`);
    }

    // Resumo de auditoria
    console.log(`${tag} ===== RESUMO =====`);
    console.log(`${tag} produto:          "${product.name}" (id=${productId})`);
    console.log(`${tag} estoque anterior: ${previousStock}`);
    console.log(`${tag} estoque atual:    ${currentStock}`);
    console.log(`${tag} notificações:     ${pending.length} encontradas, ${reserved.length} reservadas`);
    console.log(`${tag} e-mails enviados: ${succeeded.length}`);
    console.log(`${tag} e-mails falhados: ${failed.length}`);
    console.log(`${tag} iniciado em:      ${startedAt}`);
    console.log(`${tag} concluído em:     ${new Date().toISOString()}`);
    console.log(`${tag} ==================`);

  } catch (err) {
    console.error(`${tag} ERRO INESPERADO ao processar produto ${productId}:`);
    console.error(err?.stack || err?.message || err);
  }
}

module.exports = { processBackInStockNotifications };
