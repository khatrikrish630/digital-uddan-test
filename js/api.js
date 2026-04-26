const API_BASE = '/api';

function getToken() { return localStorage.getItem('du_token'); }
function setSession(token, user) {
  localStorage.setItem('du_token', token);
  localStorage.setItem('du_user', JSON.stringify(user));
}
function getUser() {
  try { return JSON.parse(localStorage.getItem('du_user')); }
  catch { return null; }
}
function clearSession() {
  localStorage.removeItem('du_token');
  localStorage.removeItem('du_user');
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Cart helpers (localStorage)
function getCart() {
  try { return JSON.parse(localStorage.getItem('du_cart')) || []; }
  catch { return []; }
}
function setCart(items) {
  localStorage.setItem('du_cart', JSON.stringify(items));
  updateCartBadge();
}
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(i => i.product_id === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({
    product_id: product.id, name: product.name,
    price: product.price, unit: product.unit,
    image_url: product.image_url, quantity: 1,
  });
  setCart(cart);
  toast(`Added ${product.name} to cart`);
}
function updateCartBadge() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const count = getCart().reduce((s, i) => s + i.quantity, 0);
  el.textContent = count > 0 ? `🛒 ${count}` : '🛒';
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

// Renders the header consistently across pages.
function renderHeader(opts = {}) {
  const { showSearch = true } = opts;
  const user = getUser();
  const headerEl = document.getElementById('header');
  if (!headerEl) return;
  headerEl.innerHTML = `
    <a href="/index.html" class="logo">Digital <span class="accent">Uddan</span></a>
    ${showSearch ? `<div class="search"><input id="searchInput" placeholder="Search for fruits, vegetables..."/></div>` : '<div style="flex:1"></div>'}
    <div class="header-actions" id="headerActions"></div>
  `;
  const actions = document.getElementById('headerActions');
  if (user && user.role === 'customer') {
    actions.innerHTML = `
      <a href="/cart.html" id="cartLink"><span id="cartCount">🛒</span></a>
      <span style="font-size:14px">Hi, ${escapeHtml(user.name.split(' ')[0])}</span>
      <button onclick="logout()">Logout</button>
    `;
  } else if (user && user.role === 'seller') {
    actions.innerHTML = `
      <a href="/seller-dashboard.html" class="seller-link">Dashboard</a>
      <span style="font-size:14px">${escapeHtml(user.shop_name || user.name)}</span>
      <button onclick="logout()">Logout</button>
    `;
  } else {
    actions.innerHTML = `
      <a href="/cart.html"><span id="cartCount">🛒</span></a>
      <a href="/login.html">Login</a>
      <a href="/seller-login.html" class="seller-link">Sell on Uddan</a>
    `;
  }
  updateCartBadge();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
