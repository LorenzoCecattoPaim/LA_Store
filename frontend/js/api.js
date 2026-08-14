/**
 * L.A. STORE - api.js
 * Cliente HTTP centralizado para comunicacao com o backend oficial.
 */

const API_URL = window.LASTORE_API_URL || 'https://lastore-api.onrender.com/api';

/* === TOKEN === */
const Auth = {
  getToken: () => localStorage.getItem('lastore_token'),
  setToken: (t) => localStorage.setItem('lastore_token', t),
  clearToken: () => localStorage.removeItem('lastore_token'),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('lastore_user') || 'null'); }
    catch { return null; }
  },
  setUser: (u) => localStorage.setItem('lastore_user', JSON.stringify(u)),
  clearUser: () => localStorage.removeItem('lastore_user'),
  isLoggedIn: () => !!Auth.getToken(),
  isAdmin: () => Auth.getUser()?.role === 'admin',
  logout: () => { Auth.clearToken(); Auth.clearUser(); window.location.href = '/pages/cliente.html'; },
};

/* === REQUEST HELPER === */
async function request(method, path, body = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth || Auth.getToken()) {
    headers.Authorization = `Bearer ${Auth.getToken()}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.status = res.status;
    err.fields = data.fields || [];
    throw err;
  }

  return data;
}

const get = (path, auth) => request('GET', path, null, auth);
const post = (path, body, auth) => request('POST', path, body, auth);
const put = (path, body, auth) => request('PUT', path, body, auth);
const patch = (path, body, auth) => request('PATCH', path, body, auth);
const del = (path, auth) => request('DELETE', path, null, auth);

/* === API === */
const api = {
  auth: {
    async register(name, email, password, phone) {
      const data = await post('/auth/register', { name, email, password, phone });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      return data;
    },
    async login(email, password) {
      const data = await post('/auth/login', { email, password });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      return data;
    },
    async me() {
      return get('/auth/me', true);
    },
    async updateProfile(payload) {
      const data = await put('/auth/profile', payload, true);
      Auth.setUser(data.user);
      return data;
    },
    async forgotPassword(email) {
      return post('/auth/forgot-password', { email });
    },
    async resetPassword(token, password) {
      return post('/auth/reset-password', { token, password });
    },
    logout: Auth.logout,
    isLoggedIn: Auth.isLoggedIn,
    isAdmin: Auth.isAdmin,
    getUser: Auth.getUser,
  },

  products: {
    async list({ category, brand, size, color, min_price, max_price, in_stock, featured, search, sort, order, page, limit } = {}) {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (brand) params.set('brand', brand);
      if (size) params.set('size', size);
      if (color) params.set('color', color);
      if (min_price) params.set('min_price', min_price);
      if (max_price) params.set('max_price', max_price);
      if (in_stock) params.set('in_stock', in_stock);
      if (featured) params.set('featured', featured);
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (order) params.set('order', order);
      if (page) params.set('page', page);
      if (limit) params.set('limit', limit);
      return get(`/products?${params}`);
    },
    async adminList({ page, limit, product_type } = {}) {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (limit) params.set('limit', limit);
      if (product_type) params.set('product_type', product_type);
      return get(`/products/admin/list?${params}`, true);
    },
    async get(slug) {
      return get(`/products/${slug}`);
    },
    async categories() {
      return get('/products/categories');
    },
    async brands() {
      return get('/products/brands');
    },
    async colors() {
      return get('/products/colors');
    },
    async sizes() {
      return get('/products/sizes');
    },
    async customizationColors() {
      return get('/products/customization-colors');
    },
    async marbleColors() {
      return get('/products/marble-colors');
    },
    async adminCustomizationColors() {
      return get('/products/admin/customization-colors', true);
    },
    async createCustomizationColor(payload) {
      return post('/products/admin/customization-colors', payload, true);
    },
    async updateCustomizationColor(id, payload) {
      return put(`/products/admin/customization-colors/${id}`, payload, true);
    },
    async deleteCustomizationColor(id) {
      return del(`/products/admin/customization-colors/${id}`, true);
    },
    async adminMarbleColors() {
      return get('/products/admin/marble-colors', true);
    },
    async createMarbleColor(payload) {
      return post('/products/admin/marble-colors', payload, true);
    },
    async updateMarbleColor(id, payload) {
      return put(`/products/admin/marble-colors/${id}`, payload, true);
    },
    async deleteMarbleColor(id) {
      return del(`/products/admin/marble-colors/${id}`, true);
    },
    async create(payload) {
      return post('/products', payload, true);
    },
    async update(id, payload) {
      return put(`/products/${id}`, payload, true);
    },
    async delete(id) {
      return del(`/products/${id}`, true);
    },
    async addImage(id, payload) {
      return post(`/products/${id}/images`, payload, true);
    },
    async addVariant(id, payload) {
      return post(`/products/${id}/variants`, payload, true);
    },
    /* Estoque por variação (tamanho + cor) */
    async getStock(id) {
      return get(`/products/${id}/stock`, true);
    },
    async updateStock(id, rows) {
      return put(`/products/${id}/stock`, { rows }, true);
    },
    async deleteStockRow(id, stockId) {
      return del(`/products/${id}/stock/${stockId}`, true);
    },
    async checkAvailability(id, size, color) {
      const params = new URLSearchParams({ size, color });
      return get(`/products/${id}/availability?${params}`);
    },
    /* Guia de medidas */
    async getSizeGuide(id) {
      return get(`/products/${id}/size-guide`);
    },
    async updateSizeGuide(id, rows) {
      return put(`/products/${id}/size-guide`, { rows }, true);
    },
    /* Admin: marcas */
    async adminBrands() { return get('/products/admin/brands', true); },
    async createBrand(payload) { return post('/products/admin/brands', payload, true); },
    async updateBrand(id, payload) { return put(`/products/admin/brands/${id}`, payload, true); },
    async deleteBrand(id) { return del(`/products/admin/brands/${id}`, true); },
    /* Admin: cores */
    async adminColors() { return get('/products/admin/colors', true); },
    async createColor(payload) { return post('/products/admin/colors', payload, true); },
    async updateColor(id, payload) { return put(`/products/admin/colors/${id}`, payload, true); },
    async deleteColor(id) { return del(`/products/admin/colors/${id}`, true); },
    /* Admin: tamanhos */
    async adminSizes() { return get('/products/admin/sizes', true); },
    async createSize(payload) { return post('/products/admin/sizes', payload, true); },
    async deleteSize(id) { return del(`/products/admin/sizes/${id}`, true); },
  },

  images: {
    /**
     * Upload de imagem via multipart/form-data.
     * Retorna uma Promise com progresso via onProgress(percent).
     */
    upload(productId, file, { alt = '', sort_order = 0, is_cover = false, onProgress } = {}) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', file);
        if (alt)        formData.append('alt', alt);
        formData.append('sort_order', String(sort_order));
        formData.append('is_cover', String(is_cover));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/images/products/${productId}/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${Auth.getToken()}`);

        if (typeof onProgress === 'function') {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              const err = new Error(data.error || `Erro ${xhr.status}`);
              err.status = xhr.status;
              reject(err);
            }
          } catch {
            reject(new Error('Resposta inválida do servidor.'));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de rede. Verifique sua conexão.'));
        xhr.ontimeout = () => reject(new Error('Tempo limite de upload excedido.'));
        xhr.timeout = 60000; // 60s

        xhr.send(formData);
      });
    },

    async list(productId) {
      return get(`/images/products/${productId}`);
    },

    async delete(imageId) {
      return del(`/images/${imageId}`, true);
    },

    async setCover(imageId) {
      return patch(`/images/${imageId}/cover`, {}, true);
    },

    async update(imageId, payload) {
      return patch(`/images/${imageId}`, payload, true);
    },
  },

  orders: {
    async create(payload) {
      return post('/orders', payload);
    },
    async mine() {
      return get('/orders/mine', true);
    },
    async get(id) {
      return get(`/orders/${id}`, true);
    },
    async list({ status, page, limit, search } = {}) {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (page) p.set('page', page);
      if (limit) p.set('limit', limit);
      if (search) p.set('search', search);
      return get(`/orders?${p}`, true);
    },
    async updateStatus(id, payload) {
      return patch(`/orders/${id}/status`, payload, true);
    },
  },

  coupons: {
    async validate(code, subtotal) {
      return post('/coupons/validate', { code, subtotal });
    },
    async list() {
      return get('/coupons', true);
    },
    async create(payload) {
      return post('/coupons', payload, true);
    },
    async toggle(id, active) {
      return patch(`/coupons/${id}`, { active }, true);
    },
  },

  addresses: {
    async list() {
      return get('/addresses', true);
    },
    async create(payload) {
      return post('/addresses', payload, true);
    },
    async update(id, payload) {
      return put(`/addresses/${id}`, payload, true);
    },
    async delete(id) {
      return del(`/addresses/${id}`, true);
    },
  },

  newsletter: {
    async subscribe(email) {
      return post('/newsletter', { email });
    },
  },

  contact: {
    async send(payload) {
      return post('/contact', payload);
    },
  },

  launches: {
    async list({ featured_home, limit, page } = {}) {
      const p = new URLSearchParams();
      if (featured_home) p.set('featured_home', featured_home);
      if (limit) p.set('limit', limit);
      if (page) p.set('page', page);
      return get(`/launches?${p}`);
    },
    async get(slug) {
      return get(`/launches/${slug}`);
    },
    async adminList({ page, limit, product_type } = {}) {
      const p = new URLSearchParams();
      if (page) p.set('page', page);
      if (limit) p.set('limit', limit);
      return get(`/launches/admin/list?${p}`, true);
    },
    async adminGet(id) {
      return get(`/launches/admin/${id}`, true);
    },
    async create(payload) {
      return post('/launches/admin', payload, true);
    },
    async update(id, payload) {
      return put(`/launches/admin/${id}`, payload, true);
    },
    async delete(id) {
      return del(`/launches/admin/${id}`, true);
    },
    async reorder(id, sort_order) {
      return patch(`/launches/admin/${id}/order`, { sort_order }, true);
    },
  },

  payment: {
    async createMPPreference(order_id) {
      return post('/payment/mp/preference', { order_id }, true);
    },
    async getShipping(cep) {
      return get(`/payment/shipping/${cep.replace(/\D/g, '')}`);
    },
  },

  stockNotifications: {
    async subscribe({ product_id, name, email } = {}) {
      return post('/stock-notifications', { product_id, name, email });
    },
    async mine() {
      return get('/stock-notifications/mine', true);
    },
    async cancel(id) {
      return del(`/stock-notifications/${id}`, true);
    },
    async adminList({ status, product_id, search, page, limit } = {}) {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (product_id) p.set('product_id', product_id);
      if (search) p.set('search', search);
      if (page) p.set('page', page);
      if (limit) p.set('limit', limit);
      return get(`/stock-notifications/admin/list?${p}`, true);
    },
    async adminMetrics() {
      return get('/stock-notifications/admin/metrics', true);
    },
    async adminTrigger(productId) {
      return post(`/stock-notifications/admin/trigger/${productId}`, {}, true);
    },
  },

  admin: {
    async metrics() {
      return get('/admin/metrics', true);
    },
    async lowStock() {
      return get('/admin/low-stock', true);
    },
    async clients({ page, limit, search } = {}) {
      const p = new URLSearchParams();
      if (page) p.set('page', page);
      if (limit) p.set('limit', limit);
      if (search) p.set('search', search);
      return get(`/admin/clients?${p}`, true);
    },
    async banners() {
      return get('/admin/banners', true);
    },
    async updateBanner(id, payload) {
      return put(`/admin/banners/${id}`, payload, true);
    },
    async newsletter() {
      return get('/newsletter', true);
    },
    async allCategories() {
      return get('/admin/categories', true);
    },
    async createCategory(payload) {
      return post('/admin/categories', payload, true);
    },
    async updateCategory(id, payload) {
      return put(`/admin/categories/${id}`, payload, true);
    },
    async deleteCategory(id) {
      return del(`/admin/categories/${id}`, true);
    },
  },
};

window.api = api;
window.Auth = Auth;
