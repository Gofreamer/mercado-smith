/* Global Smith — Global State */

const state = {
  user: null,
  profile: null,
  products: {},
  orders: [],        // pedidos do usuário logado
  allOrders: [],     // todos (admin)
  cart: {},
  currentView: 'market',
  cartOpen: false,
  sortBy: 'name',    // name | price-asc | price-desc | newest
  editingProductId: null
};

const ADMIN_UIDS = [];

function loadCartFromStorage(uid) {
  try {
    const raw = localStorage.getItem('gs_cart_' + uid);
    state.cart = raw ? JSON.parse(raw) : {};
  } catch {
    state.cart = {};
  }
}

function saveCartToStorage() {
  if (!state.user) return;
  try {
    localStorage.setItem('gs_cart_' + state.user.uid, JSON.stringify(state.cart));
  } catch {}
}

function clearCartStorage() {
  if (!state.user) return;
  try {
    localStorage.removeItem('gs_cart_' + state.user.uid);
  } catch {}
}
