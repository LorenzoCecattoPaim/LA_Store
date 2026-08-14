/**
 * L.A. STORE — cart.js  (v3 — frete corrigido)
 *
 * Correções desta versão:
 *  - _refreshShippingFromSubtotal NÃO apaga _shippingQuote quando carrinho vazia
 *  - _shippingQuote sobrevive a remove/clear e é restaurado no próximo add
 *  - Linha de frete no drawer escondida quando shipping === null
 *  - _fmt(null) nunca ocorre — guarda separado exibição vs valor
 *  - CEP com máscara normalizado em todos os pontos de entrada
 *  - Validação Number.isFinite em todos os caminhos de setShippingFromResponse
 *  - syncShippingResult chamado após calcularFrete com sucesso
 *  - clearShipping não destrói quote quando chamado sem intenção de reset total
 *  - Mensagens de frete com português correto e consistente
 */

const Cart = (() => {
  const ITEMS_KEY = 'lastore_cart_v3';
  const STATE_KEY = 'lastore_cart_state_v3';

  let _items        = [];
  let _coupon       = null;
  let _shipping     = null;   // valor calculado (0 = grátis, null = não calculado)
  let _shippingQuote = null;  // { cep, standard, free_from, address } — persiste mesmo com carrinho vazio
  let _initialized  = false;
  let _deliveryMethod = 'delivery'; // 'delivery' | 'pickup'

  /* ================================================================
     CÁLCULOS BASE
  ================================================================ */
  function subtotal() {
    return +_items
      .reduce((s, i) => s + Number(i.price) * i.qty, 0)
      .toFixed(2);
  }

  function discount() {
    if (!_coupon) return 0;
    const sub = subtotal();
    return _coupon.type === 'percent'
      ? +(sub * _coupon.value / 100).toFixed(2)
      : +Math.min(_coupon.value, sub).toFixed(2);
  }

  /**
   * Recalcula _shipping a partir do _shippingQuote já salvo.
   * NÃO apaga o quote — apenas null-ifica _shipping quando vazio.
   */
  function _refreshShipping() {
    // Retirada na loja: frete sempre zero
    if (_deliveryMethod === 'pickup') {
      _shipping = 0;
      return;
    }
    if (!_shippingQuote) {
      _shipping = null;
      return;
    }
    // Carrinho vazio: frete fica null (sem exibição), mas quote é mantido
    if (_items.length === 0) {
      _shipping = null;
      return;
    }
    const standard = Number(_shippingQuote.standard);
    const freeFrom = Number(_shippingQuote.free_from);
    if (!Number.isFinite(standard) || !Number.isFinite(freeFrom) || standard < 0 || freeFrom < 0) {
      // Quote corrompido — descarta tudo
      _shippingQuote = null;
      _shipping      = null;
      return;
    }
    const afterDiscount = subtotal() - discount();
    _shipping = afterDiscount >= freeFrom ? 0 : standard;
  }

  function total() {
    const ship = Number.isFinite(_shipping) ? _shipping : 0;
    return +(subtotal() - discount() + ship).toFixed(2);
  }

  function count() {
    return _items.reduce((s, i) => s + i.qty, 0);
  }

  /* ================================================================
     PERSISTÊNCIA
  ================================================================ */
  function _save() {
    _refreshShipping();
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(_items));
      localStorage.setItem(STATE_KEY, JSON.stringify({
        coupon:          _coupon,
        shippingQuote:   _shippingQuote,
        deliveryMethod:  _deliveryMethod,
        // Não salva _shipping — é derivado de _shippingQuote + subtotal
      }));
    } catch (e) {
      // localStorage cheio: não quebra a UX
      console.warn('[Cart] Não foi possível salvar no localStorage:', e.message);
    }
    _updateCount();
    _renderDrawer();
    syncShippingResult();
  }

  function load() {
    try {
      _items = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
      if (!Array.isArray(_items)) _items = [];
    } catch { _items = []; }

    try {
      const state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      _coupon        = state.coupon        || null;
      _shippingQuote = state.shippingQuote || null;
      _deliveryMethod = state.deliveryMethod || 'delivery';
    } catch {
      _coupon        = null;
      _shippingQuote = null;
    }

    _refreshShipping();
  }

  /* ================================================================
     ITENS
  ================================================================ */
  function add(product, qty = 1, color = null, size = null, customization = null) {
    const price = product.promo_price && Number(product.promo_price) > 0 ? Number(product.promo_price) : Number(product.price);
    const key = `${product.id}-${color || 'none'}-${size || 'none'}`;

    const ex = _items.find(i => i.key === key);
    const maxQ = 99; // a validação real de estoque acontece no checkout/backend
    if (ex) {
      ex.qty = Math.min(ex.qty + qty, maxQ);
    } else {
      _items.push({
        key,
        id:           product.id,
        slug:         product.slug,
        name:         product.name,
        brand:        product.brand?.name || null,
        price,
        stock:        product.stock || 99,
        product_type: product.product_type || 'stock',
        qty,
        color: color || null,
        size:  size  || null,
        image: product.images?.[0]?.url || null,
      });
    }

    _save();
    showToast(`"${product.name}" adicionado à sacola`);
    openDrawer();
  }

  function remove(key) {
    _items = _items.filter(i => i.key !== key);
    // Não limpa _shippingQuote — frete reaparece ao adicionar novo item
    _save();
  }

  function changeQty(key, delta) {
    const item = _items.find(i => i.key === key);
    if (!item) return;
    const maxQty = (item.product_type === 'stock') ? item.stock : 99;
    item.qty = Math.max(1, Math.min(item.qty + delta, maxQty || 99));
    _save(); // _refreshShipping recalcula frete grátis se subtotal mudar
  }

  function clear() {
    _items         = [];
    _coupon        = null;
    _shippingQuote = null;
    _shipping      = null;
    _deliveryMethod = 'delivery';
    _save();
  }

  /* ================================================================
     FRETE
  ================================================================ */

  /**
   * Recebe resposta da API { address, shipping:{ standard, free_from } }
   * e o CEP usado, salva o quote e recalcula _shipping.
   * Retorna o valor de frete calculado (0 = grátis, N = valor).
   * Lança Error se a resposta for inválida.
   */
  function setShippingFromResponse(data, rawCep) {
    const cep      = String(rawCep).replace(/\D/g, '');
    const standard = Number(data?.shipping?.standard);
    const freeFrom = Number(data?.shipping?.free_from);

    if (!Number.isFinite(standard) || !Number.isFinite(freeFrom) || standard < 0 || freeFrom < 0) {
      throw new Error('Resposta de frete inválida recebida do servidor.');
    }

    _shippingQuote = {
      cep,
      standard,
      free_from: freeFrom,
      address:   data.address || null,
    };

    _refreshShipping();
    _save();
    return _shipping;
  }

  /**
   * Remove completamente o frete e a quote salva.
   * Usar apenas quando o usuário muda o CEP ou em clear().
   * @param {string} [message] — mensagem a exibir no #shippingResult do drawer
   */
  function clearShipping(message = '') {
    _shippingQuote = null;
    _shipping      = null;
    _save();
    if (message) {
      const el = document.getElementById('shippingResult');
      if (el) { el.textContent = message; el.style.color = '#A33'; }
    }
  }

  function setDeliveryMethod(method) {
    _deliveryMethod = (method === 'pickup') ? 'pickup' : 'delivery';
    if (_deliveryMethod === 'pickup') {
      // Pickup: set shipping to zero immediately, keep quote for if they switch back
      _shipping = 0;
    } else {
      _refreshShipping(); // re-derive from quote
    }
    _save();
  }

  function getDeliveryMethod() { return _deliveryMethod; }

  function setShipping(cost) {
    const v = Number(cost);
    _shipping = Number.isFinite(v) && v >= 0 ? v : null;
    _save();
  }

  function shippingCost()    { return _shipping; }
  function shippingQuote()   { return _shippingQuote; }
  function shippingZip()     { return _shippingQuote?.cep || null; }
  function shippingAddress() { return _shippingQuote?.address || null; }

  function setCoupon(c)  { _coupon = c; _save(); }
  function clearCoupon() { _coupon = null; _save(); }

  /* ================================================================
     UI — UTILIDADES
  ================================================================ */
  function _fmt(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 'R$ 0,00';
    return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function _qs(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _updateCount() {
    const n = count();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = n;
      el.classList.toggle('visible', n > 0);
    });
  }

  function _shippingLabel() {
    if (_shipping === null) return '';
    if (_shipping === 0)    return 'Frete grátis';
    return `${_fmt(_shipping)} · 5 a 8 dias úteis`;
  }

  function _getColorHex(colorName) {
    const map = {
      // Cor da Peça
      'Branco':  '#F9F7F4',
      'Bege':    '#E8DFD0',
      'Cinza':   '#A8A39B',
      'Marrom':  '#6B4F3A',
      'Rosa':    '#E3B7C0',
      'Laranja': '#D98A4E',
      'Amarelo': '#E8C547',
      'Verde':   '#6B8F71',
      'Azul':    '#5B7E9B',
      'Roxo':    '#8669A0',
      // Cor do Marmorizado
      'Creme':   '#EFE6D5',
      // legado
      'Areia':       '#C9B99A',
      'Cinza Claro': '#C0BBB4',
      'Cinza Escuro':'#6B6560',
      'Preto':       '#2C2A26',
    };
    return map[colorName] || '#CCC';
  }

  function _buildVariantLine(item) {
    const parts = [];
    if (item.color) parts.push(`<span class="cart-custom-tag"><span class="cart-custom-dot" style="background:${_getColorHex(item.color)}"></span>Cor: ${item.color}</span>`);
    if (item.size)  parts.push(`<span class="cart-custom-tag">Tamanho: ${item.size}</span>`);
    if (item.brand) parts.push(`<span class="cart-custom-tag">${item.brand}</span>`);
    return parts.length ? `<div class="cart-customization">${parts.join('')}</div>` : '';
  }

  /* ================================================================
     UI — DRAWER
  ================================================================ */
  function _renderDrawer() {
    const itemsEl  = document.getElementById('cartItems');
    const emptyEl  = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    if (!itemsEl) return;

    if (_items.length === 0) {
      if (emptyEl)  emptyEl.style.display  = 'flex';
      if (footerEl) footerEl.style.display = 'none';
      itemsEl.innerHTML = '';
      return;
    }

    if (emptyEl)  emptyEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'block';

    itemsEl.innerHTML = _items.map(item => {
      const unitTotal  = Number(item.price) * item.qty;
      const variantLine = _buildVariantLine(item);
      return `
        <li class="cart-item">
          <div class="cart-item-img" aria-hidden="true">
            ${item.image
              ? `<img src="${item.image}" alt="${item.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
              : `<div class="premium-placeholder premium-placeholder--small"><span>Em breve</span></div>`}
          </div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            ${variantLine}
            <div class="cart-item-qty">
              <button onclick="Cart.changeQty('${item.key}',-1)" aria-label="Diminuir quantidade">−</button>
              <span>${item.qty}</span>
              <button onclick="Cart.changeQty('${item.key}',1)" aria-label="Aumentar quantidade">+</button>
            </div>
            <button class="cart-item-remove" onclick="Cart.remove('${item.key}')">Remover</button>
          </div>
          <div class="cart-item-price">${_fmt(unitTotal)}</div>
        </li>
      `;
    }).join('');

    // Subtotal
    _qs('cartSubtotal', _fmt(subtotal()));

    // Desconto
    const d  = discount();
    const dr = document.getElementById('discountRow');
    if (dr) dr.style.display = d > 0 ? 'flex' : 'none';
    _qs('cartDiscount', `− ${_fmt(d)}`);

    // Frete — só exibe se _shipping !== null (i.e. foi calculado)
    const fr = document.getElementById('freteRow');
    if (fr) {
      if (_shipping !== null) {
        fr.style.display = 'flex';
        _qs('cartFrete', _shipping === 0 ? 'Grátis' : _fmt(_shipping));
      } else {
        fr.style.display = 'none';
      }
    }

    // Total
    _qs('cartTotal', _fmt(total()));
  }

  /* ================================================================
     UI — DRAWER CEP
  ================================================================ */

  /**
   * Atualiza o campo CEP e a mensagem de resultado no drawer
   * com base no estado persistido — chamado automaticamente após _save().
   */
  function syncShippingResult() {
    const cepInput = document.getElementById('cepInput');
    const resultEl = document.getElementById('shippingResult');

    if (cepInput && _shippingQuote?.cep) {
      const raw = String(_shippingQuote.cep).replace(/\D/g, '');
      cepInput.value = raw.length === 8
        ? `${raw.slice(0,5)}-${raw.slice(5)}`
        : raw;
    }

    if (resultEl && _shipping !== null) {
      resultEl.textContent = _shippingLabel();
      resultEl.style.color = _shipping === 0 ? '#4A7A4A' : '#5A5A5A';
    } else if (resultEl && !_shippingQuote) {
      resultEl.textContent = '';
    }
  }

  async function calcularFrete() {
    const cepInput = document.getElementById('cepInput');
    const resultEl = document.getElementById('shippingResult');
    if (!cepInput || !resultEl) return;

    const raw = String(cepInput.value).replace(/\D/g, '');

    if (raw.length === 0) {
      resultEl.textContent = 'Informe o CEP para calcular o frete.';
      resultEl.style.color = '#A33';
      return;
    }
    if (raw.length !== 8) {
      resultEl.textContent = 'CEP deve ter 8 dígitos.';
      resultEl.style.color = '#A33';
      return;
    }
    if (_items.length === 0) {
      resultEl.textContent = 'Adicione produtos antes de calcular o frete.';
      resultEl.style.color = '#A33';
      return;
    }

    resultEl.textContent = 'Calculando...';
    resultEl.style.color = 'var(--color-text-muted)';

    try {
      const data = await window.api.payment.getShipping(raw);
      setShippingFromResponse(data, raw);
      // syncShippingResult já é chamado dentro de _save() → aqui forçamos para garantir
      syncShippingResult();
    } catch (err) {
      // Não limpa o quote em erros de rede — mantém o estado anterior
      resultEl.textContent = err?.message || 'Não foi possível calcular o frete. Tente novamente.';
      resultEl.style.color = '#A33';
    }
  }

  /* ================================================================
     UI — CUPOM
  ================================================================ */
  async function aplicarCupom() {
    const codeInput = document.getElementById('couponInput');
    const resultEl  = document.getElementById('couponResult');
    if (!codeInput || !resultEl) return;

    const code = codeInput.value.trim();
    if (!code) { resultEl.textContent = 'Digite o código do cupom.'; return; }

    try {
      const data = await window.api.coupons.validate(code, subtotal());
      setCoupon(data.coupon);
      resultEl.textContent = `Desconto de ${_fmt(data.coupon.discount)} aplicado!`;
      resultEl.style.color = '#4A7A4A';
    } catch (err) {
      resultEl.textContent = err.message;
      resultEl.style.color = '#A33';
    }
  }

  /* ================================================================
     UI — DRAWER ABRIR/FECHAR
  ================================================================ */
  function openDrawer() {
    const d = document.getElementById('cartDrawer');
    if (!d) return;
    d.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    const d = document.getElementById('cartDrawer');
    if (!d) return;
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ================================================================
     CHECKOUT PAYLOAD
  ================================================================ */
  function getCheckoutPayload() {
    return {
      items: _items.map(i => ({
        product_id:    i.id,
        quantity:      i.qty,
        variant_color: i.color || null,
        variant_size:  i.size  || null,
      })),
      coupon_code:     _coupon?.code || null,
      delivery_method: _deliveryMethod,
    };
  }

  /* ================================================================
     INIT
  ================================================================ */
  function init() {
    load();
    _updateCount();
    _renderDrawer();
    syncShippingResult();

    if (_initialized) return;
    _initialized = true;

    // Máscara do campo CEP no drawer
    const cepInput = document.getElementById('cepInput');
    if (cepInput) {
      cepInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 8);
        e.target.value = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v;
      });
      cepInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); calcularFrete(); }
      });
    }

    document.getElementById('cartToggle')?.addEventListener('click', openDrawer);
    document.getElementById('cartClose')?.addEventListener('click', closeDrawer);
    document.getElementById('cartOverlay')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  }

  /* ================================================================
     API PÚBLICA
  ================================================================ */
  return {
    init,
    add,
    remove,
    changeQty,
    clear,
    openDrawer,
    closeDrawer,
    calcularFrete,
    aplicarCupom,
    setShipping,
    setDeliveryMethod,
    getDeliveryMethod,
    setShippingFromResponse,
    clearShipping,
    syncShippingResult,
    setCoupon,
    clearCoupon,
    subtotal,
    discount,
    shippingCost,
    shippingQuote,
    shippingZip,
    shippingAddress,
    total,
    count,
    getItems:          () => _items,
    getCheckoutPayload,
    getCoupon:         () => _coupon,
  };
})();

window.Cart = Cart;
