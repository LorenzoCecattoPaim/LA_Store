/**
 * L.A. STORE - main.js
 * Inicializador global: header, menu, toast, reveal, utilidades.
 */

/* === TOAST === */
function showToast(msg, duration = 3200) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'alert');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove('show'), duration);
}
window.showToast = showToast;

/* === FORMAT === */
function fmtPrice(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
window.fmtPrice = fmtPrice;

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
window.fmtDate = fmtDate;

/* === BRAND / CONTACT === */
const LASTORE_CONTACT = {
  whatsappNumber: '5500000000000',
  whatsappMessage: 'Olá! Gostaria de saber mais sobre os produtos da L.A. STORE.',
};
window.LASTORE_CONTACT = LASTORE_CONTACT;

function whatsappHref(message = LASTORE_CONTACT.whatsappMessage) {
  return `https://wa.me/${LASTORE_CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
window.whatsappHref = whatsappHref;

function pageHref(file) {
  return location.pathname.includes('/pages/') ? file : `pages/${file}`;
}
window.pageHref = pageHref;

function homeHref() {
  return location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
}

function assetHref(file) {
  return location.pathname.includes('/pages/') ? `../assets/${file}` : `assets/${file}`;
}

function updateWhatsAppLinks() {
  document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href.includes('wa.me')) return;
    const isFloat = a.classList.contains('whatsapp-float');
    const textMatch = href.match(/[?&]text=([^&]+)/i);
    const text = isFloat
      ? LASTORE_CONTACT.whatsappMessage
      : textMatch
        ? decodeURIComponent(textMatch[1].replace(/\+/g, '%20'))
        : LASTORE_CONTACT.whatsappMessage;
    a.setAttribute('href', whatsappHref(text));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
}

function ensureWhatsAppFloat() {
  if (document.querySelector('.whatsapp-float')) return;
  const a = document.createElement('a');
  a.className = 'whatsapp-float';
  a.href = whatsappHref();
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Falar no WhatsApp');
  a.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  document.body.appendChild(a);
}

function markActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const target = href.split('?')[0].split('/').pop();
    if (target && page === target) a.classList.add('active');
  });
}

function buildMobileMenu() {
  const mBtn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('mainNav');
  if (!mBtn || !nav || mBtn.dataset.enhanced) return;

  mBtn.dataset.enhanced = 'true';
  mBtn.setAttribute('aria-expanded', 'false');
  mBtn.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';

  const panel = document.createElement('aside');
  panel.className = 'menu-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="menu-panel-inner">
      <div class="menu-panel-header">
        <div>
          <p class="menu-panel-kicker">Navegação rápida</p>
          <div class="menu-panel-title">Menu</div>
        </div>
        <button type="button" class="menu-panel-close" aria-label="Fechar menu">×</button>
      </div>
      <p class="menu-panel-kicker">Coleção artesanal em concreto</p>
      <div class="menu-panel-search">
        <label class="sr-only" for="menuSearchInput">Buscar produtos</label>
        <div class="search-field search-field--compact">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-3.5-3.5"></path>
          </svg>
          <input id="menuSearchInput" type="search" placeholder="Buscar por nome ou categoria">
        </div>
      </div>
      <nav class="menu-panel-nav" aria-label="Menu mobile">
        ${nav.querySelector('ul')?.innerHTML || ''}
      </nav>
      <div class="menu-panel-categories">
        <span class="menu-panel-label">Categorias</span>
        <div class="menu-panel-category-list" id="menuCategoryList">
          <a href="${pageHref('loja.html')}" data-cat="">Todos os produtos</a>
          <a href="${pageHref('loja.html')}?cat=luminarias" data-cat="luminarias">Luminárias</a>
          <a href="${pageHref('loja.html')}?cat=bandejas" data-cat="bandejas">Bandejas</a>
          <a href="${pageHref('loja.html')}?cat=vasos" data-cat="vasos">Vasos</a>
          <a href="${pageHref('loja.html')}?cat=decoracao" data-cat="decoracao">Decoração</a>
          <a href="${pageHref('loja.html')}?cat=boleiras" data-cat="boleiras">Boleiras</a>
        </div>
      </div>
      <a class="menu-panel-wpp" href="${whatsappHref()}" target="_blank" rel="noopener">Falar no WhatsApp</a>
    </div>
  `;

  const backdrop = document.createElement('div');
  backdrop.className = 'menu-backdrop';

  document.body.appendChild(panel);
  document.body.appendChild(backdrop);

  const closeMenu = () => {
    nav.classList.remove('open');
    mBtn.classList.remove('open');
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    mBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  const openMenu = () => {
    nav.classList.add('open');
    mBtn.classList.add('open');
    panel.classList.add('open');
    backdrop.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    mBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    panel.querySelector('#menuSearchInput')?.focus();
  };

  mBtn.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    if (open) openMenu(); else closeMenu();
  });
  backdrop.addEventListener('click', closeMenu);
  panel.querySelector('.menu-panel-close')?.addEventListener('click', closeMenu);
  panel.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    closeMenu();
  });
  panel.querySelector('#menuSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = e.currentTarget.value.trim();
      window.location.href = `${pageHref('loja.html')}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    }
  });
}

function initHeader() {
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  buildMobileMenu();
  markActiveNav();

  const adminLink = document.getElementById('adminLink');
  if (adminLink && window.Auth?.isAdmin()) adminLink.style.display = 'block';

  updateWhatsAppLinks();
}

/* === REVEAL ON SCROLL === */
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 70);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => obs.observe(el));
}
window.initReveal = initReveal;

/* === NEWSLETTER === */
function initNewsletter() {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input[type=email]');
      const msg = form.querySelector('.newsletter-msg');
      if (!input) return;
      try {
        await window.api.newsletter.subscribe(input.value);
        if (msg) {
          msg.textContent = '✓ Inscrito!';
          msg.style.color = '#4A7A4A';
        }
        input.value = '';
      } catch (err) {
        if (msg) {
          msg.textContent = err.message;
          msg.style.color = '#A33';
        }
      }
    });
  });
}

/* === CEP MASK === */
function maskCEP(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
  input.value = v;
}
window.maskCEP = maskCEP;

/* === FETCH CEP -> preenche formulario === */
async function fetchCEP(cep, fields = {}) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return;
  try {
    const data = await window.api.payment.getShipping(clean);
    const addr = data.address;
    Object.entries(fields).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el && addr[key]) el.value = addr[key];
    });
  } catch {}
}
window.fetchCEP = fetchCEP;

/* === RENDER PRODUCT CARD === */
function renderProductCard(p) {
  const coverImg = p.images?.find(i => i.is_cover) || p.images?.[0];
  const price = Number(p.price) === 0
    ? '<span style="font-size:13px;letter-spacing:0.08em">Sob consulta</span>'
    : fmtPrice(p.price);
  const isOutOfStock = p.product_type === 'stock' && Number(p.stock) <= 0;

  return `
    <article class="product-card reveal"
            onclick="window.location='${pageHref('produto.html')}?slug=${p.slug}'"
             style="cursor:pointer">
      <div class="product-img-wrap">
        ${isOutOfStock
          ? '<div class="product-badge" style="background:rgba(58,46,34,0.82)">Esgotado</div>'
          : (p.badge ? `<div class="product-badge">${p.badge}</div>` : '')}
        ${coverImg
          ? `<img src="${coverImg.url}" alt="${coverImg.alt || p.name}" style="width:100%;height:100%;object-fit:cover${isOutOfStock ? ';filter:grayscale(35%);opacity:0.82' : ''}">`
          : `<div class="premium-placeholder">
               <div class="premium-placeholder-mark" aria-hidden="true">
                 <svg viewBox="0 0 160 200" width="92" height="116" fill="none" stroke="currentColor" stroke-width="1.25">
                   <path d="M48 50Q40 100 44 155Q56 190 80 191Q104 190 116 155Q120 100 112 50Z"></path>
                   <ellipse cx="80" cy="50" rx="32" ry="8"></ellipse>
                 </svg>
               </div>
               <span>Imagem do produto em breve</span>
             </div>`}
        <div class="product-quick-add">
          ${isOutOfStock
            ? `<button class="btn-primary" style="font-size:10px;padding:10px 20px"
                onclick="event.stopPropagation();window.location='${pageHref('produto.html')}?slug=${p.slug}'">
                Ver produto
              </button>`
            : `<button class="btn-primary" style="font-size:10px;padding:10px 20px"
                onclick="event.stopPropagation();handleQuickAdd('${p.slug}',${p.id},'${p.name}')">
                ${Number(p.price) === 0 ? 'Solicitar' : 'Adicionar'}
              </button>`}
        </div>
      </div>
      <div class="product-material">${p.brand?.name || ''}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${price}</div>
    </article>
  `;
}
window.renderProductCard = renderProductCard;

async function handleQuickAdd(slug, id, name) {
  if (slug === 'peca-personalizada') {
    window.open(whatsappHref('Olá! Quero uma peça personalizada da L.A. STORE.'), '_blank', 'noopener');
    return;
  }
  try {
    const data = await window.api.products.get(slug);
    Cart.add(data.product, 1);
  } catch {
    showToast('Erro ao adicionar produto.');
  }
}
window.handleQuickAdd = handleQuickAdd;

/* === STATUS BADGE === */
const STATUS_MAP = {
  pending: { label: 'Pendente', cls: 'status-processando' },
  confirmed: { label: 'Confirmado', cls: 'status-processando' },
  in_production: { label: 'Em produção', cls: 'status-producao' },
  shipped: { label: 'Enviado', cls: 'status-enviado' },
  delivered: { label: 'Entregue', cls: 'status-entregue' },
  cancelled: { label: 'Cancelado', cls: 'status-cancelado' },
  refunded: { label: 'Reembolsado', cls: 'status-cancelado' },
};

function statusBadge(status) {
  const s = STATUS_MAP[status] || { label: status, cls: '' };
  return `<span class="pedido-status ${s.cls}">${s.label}</span>`;
}
window.statusBadge = statusBadge;

/* === INIT GLOBAL === */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  Cart.init();
  initReveal();
  initNewsletter();
  ensureWhatsAppFloat();
  updateWhatsAppLinks();
});
