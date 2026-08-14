const { v4: uuidv4 } = require('uuid');

function generateOrderNumber() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEC-${ts}-${rnd}`;
}

function formatPrice(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcPix(price) {
  return +(price * 0.95).toFixed(2);
}

/**
 * Valor a partir do qual o frete é gratuito.
 */
const SHIPPING_FREE_FROM = 500;

/**
 * Tabela de frete padrão (PAC/Sedex econômico) por estado.
 *
 * Critério: custo real aproximado de envio de caixa ≤ 2kg desde SP/PR/SC.
 * Norte e partes do Nordeste têm logística mais cara.
 *
 * Regiões:
 *   Sul / Sudeste / Centro-Oeste →  R$ 19,90
 *   Nordeste                     →  R$ 27,90
 *   Norte (exceto TO)            →  R$ 35,90
 *   TO (Tocantins) — Centro-Norte→  R$ 27,90
 */
const SHIPPING_TABLE = {
  // Sul
  RS: 19.90, SC: 19.90, PR: 19.90,
  // Sudeste
  SP: 19.90, RJ: 19.90, MG: 19.90, ES: 19.90,
  // Centro-Oeste
  DF: 19.90, GO: 19.90, MT: 19.90, MS: 19.90,
  // Nordeste
  BA: 27.90, SE: 27.90, AL: 27.90, PE: 27.90,
  PB: 27.90, RN: 27.90, CE: 27.90, PI: 27.90, MA: 27.90,
  // Centro-Norte
  TO: 27.90,
  // Norte
  AM: 35.90, PA: 35.90, RR: 35.90, AP: 35.90,
  AC: 35.90, RO: 35.90,
};

/**
 * Retorna o valor de frete padrão para o estado informado.
 * Fallback: R$ 27,90 para estados desconhecidos.
 */
function shippingStandardForState(state = '') {
  const uf = String(state).toUpperCase().trim();
  return SHIPPING_TABLE[uf] ?? 27.90;
}

/**
 * Calcula o frete a pagar considerando frete grátis acima de SHIPPING_FREE_FROM.
 */
function calcShipping(subtotal, state = '') {
  if (Number(subtotal) >= SHIPPING_FREE_FROM) return 0;
  return shippingStandardForState(state);
}

module.exports = {
  generateOrderNumber,
  formatPrice,
  calcPix,
  calcShipping,
  shippingStandardForState,
  SHIPPING_FREE_FROM,
  SHIPPING_TABLE,
};
