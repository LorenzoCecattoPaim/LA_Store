const { Resend } = require('resend');

/* Inicialização preguiçosa: só cria o cliente Resend quando o e-mail vai
   ser realmente enviado, e nunca derruba o servidor se a API key não
   estiver configurada (o site continua funcionando normalmente sem
   e-mails transacionais até a variável ser definida no Render). */
let _resend = null;
function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function base(content) {
  const frontendUrl = process.env.FRONTEND_URL || '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#F7EEE5;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:580px;margin:40px auto;background:#FBF6F0}
  .header{background:#2E241C;padding:32px 40px;text-align:center}
  .logo-text{color:#F3E6D8;font-size:22px;letter-spacing:0.2em;text-transform:uppercase;font-weight:300}
  .logo-text em{font-style:italic;color:#D8BD98}
  .body{padding:40px}
  .footer{background:#EFE0D2;padding:20px 40px;text-align:center;font-size:11px;color:#8A7660;letter-spacing:0.06em}
  h2{font-size:24px;font-weight:300;color:#3A2E22;margin:0 0 20px}
  p{font-size:14px;line-height:1.75;color:#5C4B3A;margin:0 0 16px}
  .btn{display:inline-block;background:#B5966A;color:#FBF6F0;padding:13px 28px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;margin:16px 0}
  .divider{height:0.5px;background:rgba(58,46,34,0.14);margin:24px 0}
  .order-table{width:100%;border-collapse:collapse;font-size:13px}
  .order-table td{padding:10px 0;border-bottom:0.5px solid rgba(58,46,34,0.14);color:#5C4B3A}
  .order-table td:last-child{text-align:right;font-weight:500}
  .total-row td{padding-top:14px;font-size:15px;color:#3A2E22;font-weight:600;border-bottom:none}
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo-text">L.A. <em>STORE</em></div></div>
  <div class="body">${content}</div>
  <div class="footer">
    © 2026 L.A. STORE · <a href="mailto:contato@lastore.com.br" style="color:#8A7660">contato@lastore.com.br</a><br>
    <a href="${frontendUrl}/privacidade" style="color:#8A7660">Política de privacidade</a>
  </div>
</div></body></html>`;
}

const FROM = process.env.MAIL_FROM || 'L.A. STORE <onboarding@resend.dev>';
const FRONTEND_URL = () => process.env.FRONTEND_URL || '';

const mailer = {
  async sendWelcome({ to, name }) {
    const client = getResendClient();
    if (!client) { console.warn('[mailer] RESEND_API_KEY não configurada — e-mail não enviado.'); return; }
    await client.emails.send({
      from: FROM,
      to,
      subject: 'Bem-vinda à L.A. STORE 🌿',
      html: base(`
        <h2>Olá, ${name}!</h2>
        <p>Que bom ter você por aqui. Sua conta foi criada com sucesso na <strong>L.A. STORE</strong>.</p>
        <p>Explore nossa coleção — BIAMAR, ANSELMI e outras marcas selecionadas para você.</p>
        <a href="${FRONTEND_URL()}/loja" class="btn">Explorar coleção</a>
        <div class="divider"></div>
        <p style="font-size:12px;color:#8A7660">Se não criou esta conta, ignore este e-mail.</p>
      `)
    });
  },

  async sendOrderConfirmed({ to, name, order }) {
    const itemsHTML = order.items.map(i =>
      `<tr><td>${i.product_name} × ${i.quantity}</td><td>R$ ${Number(i.total_price).toFixed(2).replace('.',',')}</td></tr>`
    ).join('');

    const client = getResendClient();
    if (!client) { console.warn('[mailer] RESEND_API_KEY não configurada — e-mail não enviado.'); return; }
    await client.emails.send({
      from: FROM,
      to,
      subject: `Pedido ${order.order_number} confirmado — L.A. STORE`,
      html: base(`
        <h2>Pedido confirmado!</h2>
        <p>Olá, <strong>${name}</strong>. Recebemos seu pedido e já estamos preparando tudo com carinho.</p>
        <div class="divider"></div>
        <p><strong>Pedido:</strong> ${order.order_number}</p>
        <table class="order-table">
          ${itemsHTML}
          ${order.discount > 0 ? `<tr><td>Desconto</td><td>− R$ ${Number(order.discount).toFixed(2).replace('.',',')}</td></tr>` : ''}
          <tr><td>Frete</td><td>${order.shipping_cost > 0 ? 'R$ ' + Number(order.shipping_cost).toFixed(2).replace('.',',') : 'Grátis'}</td></tr>
          <tr class="total-row"><td>Total</td><td>R$ ${Number(order.total).toFixed(2).replace('.',',')}</td></tr>
        </table>
        <div class="divider"></div>
        <p>O prazo de preparo e envio é de <strong>${order.production_days || 2} a ${(order.production_days || 2) + 3} dias úteis</strong> após a confirmação do pagamento.</p>
        ${order.isPickup ? `
        <div style="background:#F5F0EB;border-left:3px solid #9A8478;padding:18px 20px;margin:16px 0">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#141414">📍 Retirada na Loja</p>
          <p style="margin:0 0 12px;font-size:13px;color:#3A3A38">Endereço da loja L.A. STORE (a definir)</p>
          <p style="margin:0;font-size:12px;color:#8A7660">Entraremos em contato quando seu pedido estiver pronto para retirada.</p>
        </div>
        ` : `<p>Você receberá um e-mail com o código de rastreio assim que o pedido for enviado.</p>`}
        <a href="${FRONTEND_URL()}/cliente" class="btn">Acompanhar pedido</a>
      `)
    });
  },

  async sendOrderShipped({ to, name, orderNumber, trackingCode }) {
    const client = getResendClient();
    if (!client) { console.warn('[mailer] RESEND_API_KEY não configurada — e-mail não enviado.'); return; }
    await client.emails.send({
      from: FROM,
      to,
      subject: `Seu pedido ${orderNumber} foi enviado! 📦`,
      html: base(`
        <h2>Seu pedido está a caminho!</h2>
        <p>Olá, <strong>${name}</strong>. O pedido <strong>${orderNumber}</strong> saiu para entrega.</p>
        ${trackingCode ? `
          <div class="divider"></div>
          <p><strong>Código de rastreio:</strong></p>
          <p style="font-size:18px;letter-spacing:0.12em;color:#3A2E22;background:#EFE0D2;padding:14px 20px;display:inline-block">${trackingCode}</p>
          <p><a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" style="color:#3A2E22">Rastrear nos Correios →</a></p>
        ` : ''}
        <div class="divider"></div>
        <p>Esperamos que você ame sua nova peça. ✨</p>
        <a href="${FRONTEND_URL()}/cliente" class="btn">Ver meus pedidos</a>
      `)
    });
  },

  async sendPasswordReset({ to, name, resetUrl }) {
    const client = getResendClient();
    if (!client) { console.warn('[mailer] RESEND_API_KEY não configurada — e-mail não enviado.'); return; }
    await client.emails.send({
      from: FROM,
      to,
      subject: 'Redefinição de senha — L.A. STORE',
      html: base(`
        <h2>Redefinir senha</h2>
        <p>Olá, <strong>${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p>Clique no botão abaixo. O link é válido por <strong>1 hora</strong>.</p>
        <a href="${resetUrl}" class="btn">Redefinir senha</a>
        <div class="divider"></div>
        <p style="font-size:12px;color:#8A7660">Se não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.</p>
      `)
    });
  },

  async sendContactMessage({ name, email, subject, message }) {
    const client = getResendClient();
    if (!client) { console.warn('[mailer] RESEND_API_KEY não configurada — e-mail não enviado.'); return; }
    await client.emails.send({
      from: FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `[Contato] ${subject} — ${name}`,
      html: base(`
        <h2>Nova mensagem de contato</h2>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>E-mail:</strong> <a href="mailto:${email}" style="color:#3A2E22">${email}</a></p>
        <p><strong>Assunto:</strong> ${subject}</p>
        <div class="divider"></div>
        <p>${message.replace(/\n/g,'<br>')}</p>
      `)
    });
  },
};

module.exports = mailer;
