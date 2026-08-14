const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function base(content) {
  const frontendUrl = process.env.FRONTEND_URL || '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#F0EBE3;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:580px;margin:40px auto;background:#F9F7F4}
  .header{background:#2C2A26;padding:32px 40px;text-align:center}
  .logo-text{color:#F0EBE3;font-size:22px;letter-spacing:0.2em;text-transform:uppercase;font-weight:300}
  .logo-text em{font-style:italic;color:#9A9288}
  .body{padding:40px}
  .footer{background:#EDE9E3;padding:20px 40px;text-align:center;font-size:11px;color:#8A8478;letter-spacing:0.06em}
  h2{font-size:24px;font-weight:300;color:#2C2A26;margin:0 0 20px}
  p{font-size:14px;line-height:1.75;color:#4A4840;margin:0 0 16px}
  .btn{display:inline-block;background:#2C2A26;color:#F9F7F4;padding:13px 28px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;margin:16px 0}
  .divider{height:0.5px;background:#D8D0C8;margin:24px 0}
  .order-table{width:100%;border-collapse:collapse;font-size:13px}
  .order-table td{padding:10px 0;border-bottom:0.5px solid #D8D0C8;color:#4A4840}
  .order-table td:last-child{text-align:right;font-weight:500}
  .total-row td{padding-top:14px;font-size:15px;color:#2C2A26;font-weight:600;border-bottom:none}
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo-text">L.A. <em>STORE</em></div></div>
  <div class="body">${content}</div>
  <div class="footer">
    © 2026 L.A. STORE · <a href="mailto:contato@lastore.com.br" style="color:#8A8478">contato@lastore.com.br</a><br>
    <a href="${frontendUrl}/privacidade" style="color:#8A8478">Política de privacidade</a>
  </div>
</div></body></html>`;
}

const FROM = process.env.MAIL_FROM || 'L.A. STORE <onboarding@resend.dev>';
const FRONTEND_URL = () => process.env.FRONTEND_URL || '';

const mailer = {
  async sendWelcome({ to, name }) {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Bem-vinda à L.A. STORE 🌿',
      html: base(`
        <h2>Olá, ${name}!</h2>
        <p>Que bom ter você por aqui. Sua conta foi criada com sucesso na <strong>L.A. STORE</strong>.</p>
        <p>Explore nossa coleção — BIAMAR, ANSELMI e outras marcas selecionadas para você.</p>
        <a href="${FRONTEND_URL()}/loja" class="btn">Explorar coleção</a>
        <div class="divider"></div>
        <p style="font-size:12px;color:#8A8478">Se não criou esta conta, ignore este e-mail.</p>
      `)
    });
  },

  async sendOrderConfirmed({ to, name, order }) {
    const itemsHTML = order.items.map(i =>
      `<tr><td>${i.product_name} × ${i.quantity}</td><td>R$ ${Number(i.total_price).toFixed(2).replace('.',',')}</td></tr>`
    ).join('');

    await resend.emails.send({
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
          <p style="margin:0;font-size:12px;color:#8A8478">Entraremos em contato quando seu pedido estiver pronto para retirada.</p>
        </div>
        ` : `<p>Você receberá um e-mail com o código de rastreio assim que o pedido for enviado.</p>`}
        <a href="${FRONTEND_URL()}/cliente" class="btn">Acompanhar pedido</a>
      `)
    });
  },

  async sendOrderShipped({ to, name, orderNumber, trackingCode }) {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Seu pedido ${orderNumber} foi enviado! 📦`,
      html: base(`
        <h2>Seu pedido está a caminho!</h2>
        <p>Olá, <strong>${name}</strong>. O pedido <strong>${orderNumber}</strong> saiu para entrega.</p>
        ${trackingCode ? `
          <div class="divider"></div>
          <p><strong>Código de rastreio:</strong></p>
          <p style="font-size:18px;letter-spacing:0.12em;color:#2C2A26;background:#EDE9E3;padding:14px 20px;display:inline-block">${trackingCode}</p>
          <p><a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" style="color:#2C2A26">Rastrear nos Correios →</a></p>
        ` : ''}
        <div class="divider"></div>
        <p>Esperamos que você ame sua nova peça. ✨</p>
        <a href="${FRONTEND_URL()}/cliente" class="btn">Ver meus pedidos</a>
      `)
    });
  },

  async sendPasswordReset({ to, name, resetUrl }) {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Redefinição de senha — L.A. STORE',
      html: base(`
        <h2>Redefinir senha</h2>
        <p>Olá, <strong>${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p>Clique no botão abaixo. O link é válido por <strong>1 hora</strong>.</p>
        <a href="${resetUrl}" class="btn">Redefinir senha</a>
        <div class="divider"></div>
        <p style="font-size:12px;color:#8A8478">Se não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.</p>
      `)
    });
  },

  async sendContactMessage({ name, email, subject, message }) {
    await resend.emails.send({
      from: FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `[Contato] ${subject} — ${name}`,
      html: base(`
        <h2>Nova mensagem de contato</h2>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>E-mail:</strong> <a href="mailto:${email}" style="color:#2C2A26">${email}</a></p>
        <p><strong>Assunto:</strong> ${subject}</p>
        <div class="divider"></div>
        <p>${message.replace(/\n/g,'<br>')}</p>
      `)
    });
  },

  async sendStockReplenished({ to, name, productName, productImage, productUrl }) {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Seu produto voltou para a L.A. STORE ✨',
      html: base(`
        <h2>Boas notícias, ${name}!</h2>
        <p>O produto que você estava de olho voltou ao estoque — e pode esgotar novamente, então não demore.</p>
        <div class="divider"></div>
        ${productImage ? `
          <div style="text-align:center;margin:24px 0">
            <img src="${productImage}" alt="${productName}" style="max-width:280px;width:100%;border-radius:4px">
          </div>
        ` : ''}
        <p style="text-align:center;font-size:18px;font-weight:300;color:#2C2A26;margin:0 0 24px">${productName}</p>
        <div style="text-align:center">
          <a href="${productUrl}" class="btn">Ver produto</a>
        </div>
        <div class="divider"></div>
        <p style="font-size:13px;text-align:center;color:#8A8478">Garanta sua peça antes que ela esgote novamente.</p>
        <p style="font-size:12px;text-align:center;color:#8A8478;margin-top:24px">Equipe L.A. STORE</p>
      `)
    });
  }
};

module.exports = mailer;
